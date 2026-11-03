/**
 * mathpix-ai-tab.js — THE AI TAB IN RESUME MODE: MODEL LINES AND PRECONDITIONS.
 *
 * Parcel S6-3a, 13 October 2026. Design: mathpix-scripts/docs/alt-text/s6-ai-tab-design.md.
 * Rulings: AI-D1, AI-D1a, AI-D2 in phase-4-roadmap-decisions.md.
 *
 * WHAT IT DOES. Reads live state and writes the tab's own markup, in
 * tools.html (#resume-panel-ai):
 *   (a) the three "Model for <step>" lines, from the shared registry's
 *       recommendation for the active provider, overridden by each step's own
 *       picker when the person has chosen a model there;
 *   (b) the three preconditions (a PDF is loaded, pictures with empty fields
 *       exist, a key is set for the provider), ticking or unticking each step
 *       and writing the reason into its hint when it cannot run;
 *   (c) AV-1, 26 October 2026 (decision AV-D1): under each model line, a
 *       disclosure "Change the model for <step>" holding a native select bound
 *       to the same stored setting as that step's own workflow picker. It
 *       replaces the three "Change the model" buttons, which left the tab or
 *       opened a dialog. See the section marked AV-1.
 *
 *   (d) S6-3c, 14 October 2026: the estimate line, and "Run the ticked steps".
 *       Run opens ONE safeConfirm naming the estimate and the ticked steps,
 *       then runs them in AI-D1a order (correction, context, pictures), each
 *       awaited, through the three quiet entry points of S6-3b. After each step
 *       ends one line goes into #resume-ai-announce; a refusing or failing step
 *       does not stop the next; the last step's line and the final "Done" line
 *       are composed into ONE write. The run adds no provenance stamp of its own.
 *
 *   (e) AT-1, 14 October 2026 (ruling AI-D2a): after Run, "Running the ticked
 *       steps." goes into the focusable, non-live #resume-ai-status and focus
 *       moves there once the confirm has closed. (Its held Context line and the
 *       AT-6 focus move after the manager closed were retired at RP-1.)
 *
 *   (g) RP-1, 29 October 2026 (rulings RP-D1 to RP-D3): the pictures step runs
 *       with the manager CLOSED (describeAllImages openManager false), so the
 *       only dialog in a run is the confirm. One polite line per step end, "MMD
 *       correction finished in twelve seconds." plus the step's own sentence,
 *       at least LINE_GAP_MS apart, the last carrying Done. RP-3b (RP-D5): the run is
 *       a queue under the summary bar, one row per ticked step with static
 *       status text (Waiting, Started with an aria-hidden MM:SS clock,
 *       Completed in MM:SS, a refused step's own line, Failed, Skipped) and an
 *       aria-hidden running total. While a run is in progress the MMD editor
 *       is read-only and Save File and Convert are disabled.
 *       RP-2 (RP-D4): the outcomes list under the Run row is retired; the
 *       queue carries every outcome, a refused row showing its own line alone.
 *
 *   (f) AT-4, 15 October 2026 (ruling AI-D5): in dev mode (?dev=1) only, a run
 *       records each step's sends and replies in memory, and "Save AI run log"
 *       (#resume-ai-save-log) writes them as JSON. See the section marked AT-4.
 *
 * WHAT IT DOES NOT DO. Before S6-3c it ran nothing and wrote no live region.
 * It still creates no region: #resume-ai-announce is the one the markup has.
 * Every write to it waits until no dialog is open (the region is outside the
 * top layer and is ignored while one is; placement contract C10) and then for
 * a short settle after the last focus move.
 *
 * WHEN IT RUNS. refresh() is called from session-restorer-pdf.js::switchTab on
 * every tab switch. switchToResumeMode and restoreSession both end in
 * switchTab, so that one call covers "Resume mode shown" and "after a restore
 * settles", and the tab being shown always reads current state.
 *
 * EVERY COLLABORATOR IS READ AT CALL TIME and never captured: the registry, the
 * Context picker, the enhancer, the alt-text adapter, the batch runner and the
 * provider switcher are all published by other scripts.
 */
(function () {
  "use strict";

  // ==========================================================================
  // LOGGING
  // ==========================================================================
  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }
  function logError(...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[AITab]", ...args);
  }
  function logWarn(...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[AITab]", ...args);
  }
  function logInfo(...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[AITab]", ...args);
  }
  function logDebug(...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[AITab]", ...args);
  }

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  /** The reasons written into an unticked step's hint. Pinned by Group L. */
  const REASONS = Object.freeze({
    NO_PDF: "No PDF is loaded.",
    ALL_DESCRIBED: "Every picture already has a description.",
    ALL_DESCRIBED_WITH_FILE: "Every picture with a file already has a description.",
    NO_PICTURES: "There are no pictures in this document.",
    NO_KEY: "No AI provider key is set.",
  });

  /** How a model line says where its model came from. */
  const BASIS = Object.freeze({
    RECOMMENDED: "recommended",
    CHOSEN: "chosen",
  });

  /**
   * The three steps, in AI-D1a order. `purpose` is the registry's purpose key
   * (MathPixModelRegistry.PURPOSES); `label` is the person-facing name used in
   * the model line and the "Change the model" button.
   */
  const STEPS = Object.freeze([
    Object.freeze({
      key: "correction",
      label: "MMD correction",
      short: "MMD correction",
      purpose: "mmd-correction",
    }),
    Object.freeze({
      key: "context",
      label: "Context auto-fill",
      short: "Context",
      purpose: "context",
    }),
    Object.freeze({
      key: "pictures",
      label: "Picture descriptions",
      short: "Picture descriptions",
      purpose: "alt-text",
    }),
  ]);

  /**
   * MEASURED COST FIGURES, in US dollars, keyed by model id. A model absent
   * from a table is "not measured for this model" and is NEVER read as zero
   * (the PC-1 trap). Provenance of every figure:
   *
   *   pictures (per picture, all cells ended `stop`): opus-5.5 0.0369 is the
   *     mean list-price cost of 33 cells, all `stop`, all resolved to
   *     anthropic/claude-opus-5.5 (0.036899, total 1.217668), in
   *     .claude/measurements/ma-17-selfcheck-round/seal-1/ma17-aggregate.json
   *     (found at S6-3d; the registry notes of 0.038 are at the 2,000-token
   *     ceiling and about 0.052 at 3,000, a different configuration).
   *     gpt-6-astra 0.044 is the registry's Foundry list price, not re-sourced.
   *   context (per call): AW-27 round, OpenRouter's own per-generation cost,
   *     mean of 18 cells: fable-5 0.195269, sonnet-5 0.059436, haiku-4.5
   *     0.039844. Foundry cells (gpt-5.6-sol) were UNPRICED: the proxy returns
   *     no cost field.
   *   correction (per run): AW-21, enhancement spend over 15 completed runs on
   *     five documents: fable-5 14.406 / 15 = 0.9604, opus-5 6.449 / 15 =
   *     0.4299. The spread by document is wide (fable-5 1.56 to 4.48 per three
   *     runs), so these are means, not bounds. sonnet-5 and haiku-4.5 are left
   *     out: 5 and 4 of their 15 cells failed, so a per-completed-run figure
   *     would be a guess. gpt-5.6-sol is UNPRICED.
   *     Q3-2 (20 October 2026): fable-5.1 11.52639 / 15 = 0.7684, the wire
   *     usage.cost of 15 live cells (5 documents by 3 runs, all `stop`, no
   *     judge), in .claude/measurements/q3-1-fable-5-1-round/README.md and
   *     mathpix-scripts/core/mathpix-model-evidence.json.
   */
  const MEASURED_COST_USD = Object.freeze({
    correction: Object.freeze({
      "anthropic/claude-fable-5.1": 11.52639 / 15,
      "anthropic/claude-fable-5": 14.406 / 15,
      "anthropic/claude-opus-5": 6.449 / 15,
    }),
    context: Object.freeze({
      "anthropic/claude-fable-5": 0.195269,
      "anthropic/claude-sonnet-5": 0.059436,
      "anthropic/claude-haiku-4.5": 0.039844,
    }),
    pictures: Object.freeze({
      "anthropic/claude-opus-5.5": 0.0369,
      "azure-openai/gpt-6-astra": 0.044,
    }),
  });

  /** AV-3 (AV-D3 E2): the two cost words on a model line. */
  const COST_WORDS = Object.freeze({
    MEASURED: "cost measured",
    NOT_MEASURED: "cost not measured",
  });

  /** The catalogue tags Foundry names "GPT-6.1 Sol (Foundry)"; the provider is said once, in the bar (AV-D3 E3). */
  const PROVIDER_NAME_SUFFIX = /\s*\(Foundry\)$/;

  const ESTIMATE_PREFIX = "Estimated cost:";
  const NOT_MEASURED_TEXT = "not measured for this model";
  const PICTURE_COST_DECIMALS = 4;
  const TOTAL_COST_DECIMALS = 2;

  const RUN_TITLE = "Run the ticked steps";
  const CONFIRM_RUN_TEXT = "Run";
  const CONFIRM_CANCEL_TEXT = "Cancel";
  /** AT-1: the focused, non-live status paragraph the person lands on after Run. */
  const RUNNING_TEXT = "Running the ticked steps.";
  const FINISHED_TEXT = "Finished.";
  /** RP-3d (RP-D6): the status paragraph on the press of Cancel, and when the run has stopped. */
  const CANCELLING_TEXT = "Cancelling.";
  const CANCELLED_TEXT = "Cancelled.";
  /**
   * RP-5 (RP-D9): a rehearsal runs the real queue, clocks, lock and Cancel with stand-ins for the
   * three steps. Dev mode only. The words it uses, and how long a stand-in takes.
   */
  const REHEARSAL_TITLE = "Rehearse the ticked steps";
  const REHEARSAL_CONFIRM_TEXT = "Rehearsal: no AI calls, nothing is written, no cost.";
  const REHEARSAL_ESTIMATE_TEXT = "No cost: rehearsal";
  const REHEARSAL_LINE_CLAUSE = "Rehearsal, nothing was written.";
  const REHEARSAL_STEP_MS = 4000;
  const REHEARSAL_PICTURE_MS = 1500;
  /** A stand-in waits in slices this long, so a Cancel takes hold within one slice. */
  const REHEARSAL_SLICE_MS = 100;
  const REHEARSAL_STEP_LINES = Object.freeze({
    correction: "no corrections were applied.",
    context: "no context was filled.",
    pictures: "no descriptions were written.",
  });
  const NO_LINE_TEXT = "no message was returned.";
  const THREW_TEXT = "stopped unexpectedly.";

  /**
   * RP-3b (RP-D5): the words on each row of the run queue. Static text with no
   * live role; the spoken line comes from #resume-ai-announce. A completed step
   * reads "Completed in 1 minute 32 seconds" (RP-D7a); a failed step's own line follows its word, as
   * "Failed: <line>"; a refused step's row shows its line alone (RP-D4), since
   * that line already says it was not applied.
   */
  const STATUS_WORDS = Object.freeze({
    WAITING: "Waiting",
    STARTED: "Started",
    COMPLETED: "Completed in",
    FAILED: "Failed",
    SKIPPED: "Skipped",
    // RP-3d: a stopped run. The pictures row reads CANCELLING while one picture is still in flight.
    CANCELLED: "Cancelled",
    NOT_RUN: "Not run",
    CANCELLING: "Cancelling after this picture",
  });

  /** The icon each row status shows (library names; Convert's rows use the same four). */
  const QUEUE_ICONS = Object.freeze({
    waiting: "hourglass",
    started: "refresh",
    completed: "checkCircle",
    failed: "error",
    refused: "warning",
    skipped: "warning",
    cancelled: "close",
    notrun: "hourglass",
  });

  const QUEUE_IDS = Object.freeze({
    region: "resume-ai-queue",
    total: "resume-ai-queue-total",
    totalClock: "resume-ai-queue-total-clock",
    done: "resume-ai-queue-done",
  });
  const QUEUE_SELECTORS = Object.freeze({
    status: ".mathpix-progress-status",
    icon: ".mathpix-progress-icon",
    clock: ".ai-queue-clock",
    detail: ".ai-queue-detail",
    sublist: ".ai-queue-sublist",
  });

  /**
   * RP-D2: consecutive spoken lines of one run are at least this far apart.
   * BORROWED, not measured: the placement contract's 1,000 ms reporting bound
   * (rule C10). Tune it only from a listen.
   */
  const LINE_GAP_MS = 1000;
  /** The visual ticker beside "Started" updates once a second. */
  const TICK_MS = 1000;
  const MS_PER_SECOND = 1000;
  const SECONDS_PER_MINUTE = 60;
  /** RP-D1: counts below ten are words, from 10 digits (UT-D7a). */
  const NUMBER_WORDS = Object.freeze([
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  ]);
  const UNDER_A_SECOND_TEXT = "under a second";
  /** RP-3c: registry entry fields that may hold a picture's file name, first one set wins. */
  const PICTURE_NAME_FIELDS = Object.freeze(["fileName", "filename", "originalFilename"]);

  /** Longest wait for every dialog to close before a line is written anyway. */
  const MODAL_CLEAR_MAX_MS = 5000;
  const MODAL_CLEAR_POLL_MS = 50;
  /**
   * After the last dialog is gone, a polite write within about ten
   * milliseconds of a focus change is dropped (placement contract, E1).
   * 350 ms is the figure setup-tool.js measured for the same close.
   */
  const ANNOUNCE_SETTLE_MS = 350;

  const ELEMENT_IDS = Object.freeze({
    panel: "resume-panel-ai",
    tab: "resume-tab-ai",
    run: "resume-ai-run",
    cancel: "resume-ai-cancel",
    rehearse: "resume-ai-rehearse",
    badge: "resume-ai-queue-badge",
    announce: "resume-ai-announce",
    status: "resume-ai-status",
    estimate: "resume-ai-estimate",
    provider: "resume-ai-provider-name",
    ticked: "resume-ai-ticked-count",
    redescribe: "resume-ai-redescribe",
    diff: "resume-ai-correction-diff",
    diffBody: "resume-ai-correction-diff-body",
    saveLog: "resume-ai-save-log",
    // RP-D3: locked for the length of a run (the editor read-only, the two buttons disabled).
    editor: "resume-mmd-editor-textarea",
    saveFile: "resume-mmd-save-file-btn",
    convert: "resume-convert-btn",
  });

  /** AT-4 (AI-D5): the run log's shape name and how a removed secret reads. */
  const RUN_LOG_SCHEMA = "mathpix-ai-run-log/1";
  const REMOVED_TEXT = "[removed]";
  /** Header and body keys that carry a credential, matched whole and case-blind. */
  const SECRET_KEY_PATTERN =
    /^(authorization|x-user-token|x-api-key|api[-_]?key|apikey|openrouter_api_key|key|secret|password|access[-_]?token|bearer)$/i;
  /** localStorage keys whose values are credentials, swept out of the whole log. */
  const SECRET_STORAGE_KEYS = Object.freeze(["openrouter_api_key"]);
  /** A secret shorter than this is not swept as text (it would match inside ordinary words). */
  const MIN_SECRET_SWEEP_CHARS = 8;
  /** The most response text kept for one wire body. */
  const WIRE_BODY_MAX_CHARS = 2000000;
  const RUN_LOG_FILE_SUFFIX = "ai-run";
  const RUN_LOG_FALLBACK_BASE = "session";

  /** AT-2: the two sides of the correction diff, and the text above each. */
  const DIFF_SIDES = Object.freeze([
    Object.freeze({ mode: "original", caption: "Before the correction (removed lines highlighted)" }),
    Object.freeze({ mode: "enhanced", caption: "After the correction (added lines highlighted)" }),
  ]);

  const stepId = (step) => `resume-ai-step-${step.key}`;
  const hintId = (step) => `resume-ai-step-${step.key}-hint`;
  const modelLineId = (step) => `resume-ai-model-${step.key}`;
  /** AV-1: the disclosure and the native select that change one step's model. */
  const advancedId = (step) => `resume-ai-advanced-${step.key}`;
  const selectId = (step) => `resume-ai-select-${step.key}`;
  /** AV-D4: the two option groups of a model select. The default sits alone in the first. */
  const SELECT_GROUP_LABELS = Object.freeze({
    RECOMMENDED: "Recommended",
    OTHER: "Other models",
  });

  // ==========================================================================
  // STATE READERS (all at call time)
  // ==========================================================================

  /** running: a run (confirm included) is in progress. watching: the restore observer is attached. */
  const state = {
    running: false,
    watching: false,
    watchingDialogs: false,
    watchingProvider: false,
    choiceCache: new Map(),
    log: null,
    logSecrets: null,
    // RP-3b: the queue's one interval id, when the run and the running step began, and which step runs.
    ticker: null,
    runStartedAt: 0,
    stepStartedAt: 0,
    runningStep: null,
    // RP-3c: the pictures row's sub-rows by picture id, the picture now running and its start, and the counts.
    pictureItems: [],
    runningPicture: null,
    pictureStartedAt: 0,
    pictureTotal: 0,
    picturesDone: 0,
    // RP-1: when the last line of this run was written.
    lastLineAt: null,
    // RP-3d: the steps are being run (Cancel can act) and Cancel has been pressed for this run.
    runActive: false,
    cancelRequested: false,
    // RP-5: this run is a rehearsal (stand-ins, nothing written); the stand-ins read the Cancel flag.
    rehearsal: false,
  };

  const byId = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function activeProviderId() {
    const switcher = window.ProviderSwitcher;
    return switcher && typeof switcher.getActive === "function"
      ? switcher.getActive()
      : "openrouter";
  }

  function providerLabel(providerId) {
    const switcher = window.ProviderSwitcher;
    const known =
      switcher && typeof switcher.getKnown === "function"
        ? switcher.getKnown()
        : [];
    const found = Array.isArray(known)
      ? known.find((p) => p && p.id === providerId)
      : null;
    return found && found.label ? found.label : providerId;
  }

  /** The registry's recommended model id for a purpose, or null. */
  function recommendedIdFor(purpose, providerId) {
    const registry = window.MathPixModelRegistry;
    if (!registry || typeof registry.recommendedModel !== "function") {
      return null;
    }
    const entry = registry.recommendedModel(purpose, providerId);
    return entry && typeof entry.modelId === "string" ? entry.modelId : null;
  }

  /**
   * The model id the person has set in a step's own picker, or null.
   * Context and Picture descriptions keep an explicit pick; the enhancer keeps
   * only its selected model, so a choice is a selection that differs from the
   * recommendation (read through the peek, which never creates the singleton).
   */
  function chosenIdFor(step, recommendedId) {
    if (step.key === "context") {
      const ctx = window.MathPixContextAI;
      const pick =
        ctx && typeof ctx._getUserModelChoice === "function"
          ? ctx._getUserModelChoice()
          : null;
      // AV-1b: a pick the Context picker does not offer is dropped, not shown.
      if (pick && isStrandedPick(step, pick)) {
        ctx._setUserModelChoice(null);
        if (typeof ctx._syncPickerToChoice === "function") ctx._syncPickerToChoice();
        return null;
      }
      return pick || null;
    }
    if (step.key === "pictures") {
      const adapter = window.MathPixAltTextCloudAdapter;
      const pick =
        adapter && typeof adapter._getUserModelChoice === "function"
          ? adapter._getUserModelChoice()
          : null;
      // AV-1: a pick left over from another provider is dropped, not shown.
      if (
        pick &&
        typeof adapter._isModelProviderAvailable === "function" &&
        !adapter._isModelProviderAvailable(pick)
      ) {
        adapter._setUserModelChoice(null);
        return null;
      }
      // AV-1b: and so is a pick the image manager's picker does not offer.
      if (pick && isStrandedPick(step, pick)) {
        adapter._setUserModelChoice(null);
        return null;
      }
      return pick || null;
    }
    const peek = window.peekMathPixAIEnhancer;
    const enhancer = typeof peek === "function" ? peek() : null;
    // AV-1: a selection from another provider is replaced before it is read,
    // so the line and the run cannot disagree on Foundry.
    if (enhancer && typeof enhancer.syncModelToProvider === "function") {
      enhancer.syncModelToProvider();
    }
    const selected = enhancer && enhancer.selectedModel;
    if (typeof selected !== "string" || !selected || selected === recommendedId) {
      return null;
    }
    // AV-1b: a selection the correction dialog does not offer is replaced by the
    // registry default, as syncModelToProvider replaces one from another provider.
    // Set on the enhancer directly, so nothing is written to the saved preferences.
    if (recommendedId && isStrandedPick(step, selected)) {
      enhancer.selectedModel = recommendedId;
      return null;
    }
    return selected;
  }

  /**
   * A model's display name from the shared catalogue, or null. S6-3b: the line
   * names the model the way the pickers do and keeps the id beside it.
   */
  function displayNameFor(modelId, providerId) {
    const selector = window.EmbedModelSelector;
    if (!selector || typeof selector.getEligibleModels !== "function") return null;
    try {
      const all = selector.getEligibleModels({ providerId, capabilities: [] });
      const found = Array.isArray(all)
        ? all.find((model) => model && model.id === modelId)
        : null;
      return found && typeof found.name === "string" && found.name
        ? found.name
        : null;
    } catch (error) {
      logWarn("displayNameFor: getEligibleModels threw", error);
      return null;
    }
  }

  /**
   * AV-3 (AV-D3 E1, E2): the parts of one step's model line. The provider is
   * said once, in the summary bar, so the line carries the model's name, how
   * it was picked and whether its cost has been measured. `name` is null when
   * no model is recommended for the provider.
   */
  function modelPartsFor(step) {
    const providerId = activeProviderId();
    const lead = `Model for ${step.label}:`;
    const recommendedId = recommendedIdFor(step.purpose, providerId);
    const chosenId = chosenIdFor(step, recommendedId);
    const modelId = chosenId || recommendedId;

    if (!modelId) {
      return { lead, name: null, plain: `none recommended for ${providerLabel(providerId)}` };
    }
    const measured = typeof MEASURED_COST_USD[step.key][modelId] === "number";
    return {
      lead,
      name: (displayNameFor(modelId, providerId) || modelId).replace(PROVIDER_NAME_SUFFIX, ""),
      basis: chosenId ? BASIS.CHOSEN : BASIS.RECOMMENDED,
      cost: measured ? COST_WORDS.MEASURED : COST_WORDS.NOT_MEASURED,
    };
  }

  /** The model line text for one step: "Model for X: Name, recommended, cost not measured." */
  function modelLineFor(step) {
    const parts = modelPartsFor(step);
    if (parts.name === null) return `${parts.lead} ${parts.plain}`;
    return `${parts.lead} ${parts.name}, ${parts.basis}, ${parts.cost}.`;
  }

  /** One chip: a decorative icon beside visible words (the words carry the meaning). */
  function buildChip(iconName, text, isCurrent) {
    const chip = document.createElement("span");
    chip.className = isCurrent
      ? "ai-chip resume-session-badge resume-session-badge-current"
      : "ai-chip resume-session-badge";
    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("data-icon", iconName);
    const words = document.createElement("span");
    words.className = "ai-chip-text";
    words.textContent = text;
    chip.append(icon, words);
    return chip;
  }

  /**
   * A comma and its space, or a full stop, that is read but not drawn. The space
   * lives INSIDE the span and the span keeps it (white-space: pre in
   * mathpix-context.css): a trailing space in a nowrap hidden box collapses, and
   * the accessibility tree and a braille display then ran the words together.
   */
  function buildSeparator(text) {
    const sep = document.createElement("span");
    sep.className = "sr-only ai-sep";
    sep.textContent = text;
    return sep;
  }

  /**
   * Write one step's model line as a name and two chips, with hidden commas so
   * the accessible text reads as one phrase. Rebuilt only when it changes, so a
   * refresh never disturbs the line, and the textContent equals modelLineFor.
   */
  function writeModelLine(step) {
    const line = byId(modelLineId(step));
    if (!line) return;
    const parts = modelPartsFor(step);
    const signature = modelLineFor(step);
    if (line.dataset.aiLine === signature) return;

    const lead = document.createElement("span");
    lead.className = "ai-model-lead";
    lead.textContent = parts.lead;
    if (parts.name === null) {
      line.replaceChildren(lead, ` ${parts.plain}`);
    } else {
      const name = document.createElement("span");
      name.className = "ai-model-name";
      name.textContent = parts.name;
      line.replaceChildren(
        lead,
        " ",
        name,
        buildSeparator(", "),
        buildChip("check", parts.basis, parts.basis === BASIS.RECOMMENDED),
        buildSeparator(", "),
        buildChip("coins", parts.cost, parts.cost === COST_WORDS.MEASURED),
        buildSeparator("."),
      );
      if (window.IconLibrary && typeof window.IconLibrary.populateIcons === "function") {
        window.IconLibrary.populateIcons(line);
      }
    }
    line.dataset.aiLine = signature;
  }

  function hasProviderKey() {
    const switcher = window.ProviderSwitcher;
    if (!switcher || typeof switcher.isAvailable !== "function") return false;
    return switcher.isAvailable(activeProviderId()) === true;
  }

  /** The source PDF, through the Context tab's own provider first. */
  function hasPdf() {
    const ctx = window.MathPixContextAI;
    if (ctx && ctx.provider && typeof ctx.provider.getSourcePDF === "function") {
      return Boolean(ctx.provider.getSourcePDF());
    }
    const restorer =
      typeof window.getMathPixSessionRestorer === "function"
        ? window.getMathPixSessionRestorer()
        : null;
    return Boolean(restorer && restorer.restoredSession?.source);
  }

  function imageEntries() {
    const restorer =
      typeof window.getMathPixSessionRestorer === "function"
        ? window.getMathPixSessionRestorer()
        : null;
    const registry = restorer && restorer.imageRegistry;
    return registry && typeof registry.getAllImages === "function"
      ? registry.getAllImages()
      : [];
  }

  /** AT-2 (AI-D3): is "Also re-describe pictures that already have a description" ticked? */
  function redescribeOn() {
    const box = byId(ELEMENT_IDS.redescribe);
    return Boolean(box) && box.checked === true;
  }

  /**
   * Pictures the run will describe, by the batch runner's own predicate. With
   * the re-describe box ticked that includes pictures whose description is an
   * unreviewed AI one; a description a person wrote or reviewed never is.
   */
  function uncoveredPictures() {
    return partitionPictures().targets;
  }

  /** UT-D7a: the targets, and how many would-be targets were left out for a missing file. */
  function partitionPictures() {
    const runner = window.MathPixAltTextBatchRunner;
    if (!runner || typeof runner.partitionTargets !== "function") {
      return { targets: [], skippedMissing: 0 };
    }
    // UT-D7: a picture with no file is not counted, so the estimate and the
    // hint charge only for pictures the run can actually describe.
    const restorer =
      typeof window.getMathPixSessionRestorer === "function"
        ? window.getMathPixSessionRestorer()
        : null;
    return runner.partitionTargets(imageEntries(), {
      includeDescribed: redescribeOn(),
      skipMissingFiles: true,
      blobUrlMap: restorer && restorer.imageBlobUrlMap,
    });
  }

  /**
   * Why a step cannot run, or null when it can. The key is asked first: with
   * no key nothing can run, whatever else is true.
   */
  function reasonFor(step) {
    if (!hasProviderKey()) return REASONS.NO_KEY;
    if (step.key === "pictures") {
      if (imageEntries().length === 0) return REASONS.NO_PICTURES;
      const { targets, skippedMissing } = partitionPictures();
      if (targets.length > 0) return null;
      return skippedMissing > 0
        ? REASONS.ALL_DESCRIBED_WITH_FILE
        : REASONS.ALL_DESCRIBED;
    }
    return hasPdf() ? null : REASONS.NO_PDF;
  }

  // ==========================================================================
  // WRITERS (write only if changed)
  // ==========================================================================

  function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }

  /**
   * Tick or untick one step and write its hint. A step whose precondition
   * holds is ticked when it was not eligible before (or never evaluated) and
   * otherwise left as the person set it; a step whose precondition fails is
   * unticked, disabled, and explains why in the hint that describes it.
   */
  function applyStep(step) {
    const box = byId(stepId(step));
    const hint = byId(hintId(step));
    if (!box) return;

    if (hint && hint.dataset.defaultText === undefined) {
      hint.dataset.defaultText = hint.textContent.replace(/\s+/g, " ").trim();
    }

    const reason = reasonFor(step);
    const wasEligible = box.dataset.aiEligible === "true";

    if (reason) {
      box.checked = false;
      box.disabled = true;
      box.dataset.aiEligible = "false";
      setText(hint, reason);
      return;
    }

    // A refresh landing mid-run (a tab switch) must not re-enable a box.
    box.disabled = state.running;
    if (!wasEligible) box.checked = true;
    box.dataset.aiEligible = "true";
    if (!hint) return;
    if (step.key === "pictures") {
      // AT-2: the hint says how many pictures the run will describe.
      const count = uncoveredPictures().length;
      const noun = count === 1 ? "picture" : "pictures";
      setText(hint, `${hint.dataset.defaultText} ${count} ${noun}.`);
      return;
    }
    setText(hint, hint.dataset.defaultText);
  }

  /** AT-2: the re-describe box is usable when there is a key, a picture and no run in flight. */
  function applyRedescribeBox() {
    const box = byId(ELEMENT_IDS.redescribe);
    if (!box) return;
    box.disabled = state.running || !hasProviderKey() || imageEntries().length === 0;
  }

  function refresh() {
    if (!byId(ELEMENT_IDS.panel)) return false;
    applyRedescribeBox();
    STEPS.forEach((step) => applyStep(step));
    refreshModels();
    watchRestore();
    updateEstimate();
    updateRunButton();
    updateSaveLogButton();
    logDebug("refresh done");
    return true;
  }

  // ==========================================================================
  // THE ESTIMATE (S6-3c)
  // ==========================================================================

  /** The steps whose box is ticked and usable, in AI-D1a order. */
  function tickedSteps() {
    return STEPS.filter((step) => {
      const box = byId(stepId(step));
      return Boolean(box) && box.checked && !box.disabled;
    });
  }

  /** The model id a step will use: the person's pick, else the recommendation. */
  function resolvedModelId(step) {
    const providerId = activeProviderId();
    const recommendedId = recommendedIdFor(step.purpose, providerId);
    return chosenIdFor(step, recommendedId) || recommendedId;
  }

  const usd = (value, decimals) => `$${value.toFixed(decimals)}`;

  /**
   * One line: the summed cost of the ticked steps that have a MEASURED figure,
   * with a step that has none named as "not measured for this model" and
   * never counted as zero. Foundry models are unpriced in the records, so they
   * read as not measured.
   */
  function estimateLine(steps) {
    const ticked = steps || tickedSteps();
    if (ticked.length === 0) return `${ESTIMATE_PREFIX} no steps are ticked.`;

    let total = 0;
    let measured = 0;
    const parts = ticked.map((step) => {
      const figure = MEASURED_COST_USD[step.key][resolvedModelId(step)];
      if (typeof figure !== "number") {
        return `${step.short} ${NOT_MEASURED_TEXT}`;
      }
      if (step.key === "pictures") {
        const count = uncoveredPictures().length;
        total += figure * count;
        measured += 1;
        return `${step.short} ${count} at ${usd(figure, PICTURE_COST_DECIMALS)}`;
      }
      total += figure;
      measured += 1;
      return `${step.short} ${usd(figure, TOTAL_COST_DECIMALS)}`;
    });

    if (measured === 0) {
      return `${ESTIMATE_PREFIX} ${NOT_MEASURED_TEXT.replace("this model", "these models")} (${parts.join(", ")}).`;
    }
    const scope = measured < ticked.length ? " for the measured steps" : "";
    return `${ESTIMATE_PREFIX} about ${usd(total, TOTAL_COST_DECIMALS)}${scope} (${parts.join(", ")}).`;
  }

  /**
   * RP-6b (RP-D10): the run confirm as a lead and a list, from one composer for the real run and the
   * rehearsal. The lead is the dialog's spoken description; the items go in an ordered list after it.
   * Each step's figure is rounded to whole cents first and the lead states the SUM of those rounded
   * figures, so the box agrees with itself (the tab's estimate line keeps its own, unrounded total).
   * A step with no measured figure reads "cost not measured" and the lead drops the total.
   */
  const CENTS_PER_USD = 100;
  const COST_NOT_FULLY_MEASURED_TEXT = "Cost not fully measured.";

  function confirmParts(steps, rehearsal) {
    const pictureCount = uncoveredPictures().length;
    const pictureWords = countWords(pictureCount, "picture", "pictures", { words: true });

    if (rehearsal) {
      return {
        lead: REHEARSAL_CONFIRM_TEXT,
        items: steps.map((step) =>
          step.key === "pictures" ? `${step.label}, ${pictureWords}` : step.label,
        ),
      };
    }

    const providerId = activeProviderId();
    let totalCents = 0;
    let unmeasured = 0;
    const items = steps.map((step) => {
      const modelId = resolvedModelId(step);
      const name = modelId
        ? (displayNameFor(modelId, providerId) || modelId).replace(PROVIDER_NAME_SUFFIX, "")
        : null;
      const figure = modelId ? MEASURED_COST_USD[step.key][modelId] : undefined;
      const isPictures = step.key === "pictures";
      const parts = [step.label];
      if (name) parts.push(name);
      if (isPictures) parts.push(pictureWords);
      if (typeof figure !== "number") {
        unmeasured += 1;
        parts.push(COST_WORDS.NOT_MEASURED);
        return parts.join(", ");
      }
      const cents = Math.round(figure * (isPictures ? pictureCount : 1) * CENTS_PER_USD);
      totalCents += cents;
      parts.push(`about ${usd(cents / CENTS_PER_USD, TOTAL_COST_DECIMALS)}`);
      return parts.join(", ");
    });

    const stepsWords = countWords(steps.length, "step", "steps", { words: true });
    const lead =
      unmeasured === 0
        ? `Run ${stepsWords} for about ${usd(totalCents / CENTS_PER_USD, TOTAL_COST_DECIMALS)}?`
        : `Run ${stepsWords}? ${COST_NOT_FULLY_MEASURED_TEXT}`;
    return { lead, items };
  }

  /** The ordered list of items, in run order, handed to the confirm as its details option. */
  function buildConfirmDetails(items) {
    const list = document.createElement("ol");
    list.className = "mathpix-ai-confirm-steps";
    items.forEach((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      list.appendChild(item);
    });
    return list;
  }

  function updateEstimate() {
    if (state.running) return;
    setText(byId(ELEMENT_IDS.estimate), estimateLine());
  }

  /**
   * AV-3 (AV-D3 E3, E4): the provider's name and "N of 3 steps ticked" in the
   * summary bar. Both are plain text inside a paragraph with no live role, so a
   * tick or a provider switch changes them silently. Not touched mid-run, when
   * the boxes are disabled and would read as unticked.
   */
  function updateSummary() {
    if (state.running) return;
    setText(byId(ELEMENT_IDS.provider), providerLabel(activeProviderId()));
    setText(
      byId(ELEMENT_IDS.ticked),
      `${tickedSteps().length} of ${STEPS.length} steps ticked`,
    );
  }

  // ==========================================================================
  // THE RUN BUTTON (S6-3c)
  // ==========================================================================

  /**
   * True once a restore has finished. The restorer holds the manage-images
   * button disabled for the whole restore (_setManageImagesBusy) and releases it
   * in a finally, so that button is the restore's own settle signal.
   */
  function restoreSettled() {
    const restorer =
      typeof window.getMathPixSessionRestorer === "function"
        ? window.getMathPixSessionRestorer()
        : null;
    if (!restorer || !restorer.restoredSession) return false;
    const busyButton = restorer.elements && restorer.elements.manageImagesBtn;
    return !(busyButton && busyButton.disabled);
  }

  function updateRunButton() {
    const button = byId(ELEMENT_IDS.run);
    if (!button) return;
    button.disabled =
      state.running || tickedSteps().length === 0 || !restoreSettled();
    updateRehearseButton(button.disabled);
  }

  /**
   * RP-5 (RP-D9): the Rehearse button shows only in dev mode and is disabled (inert) on every
   * other page; in dev mode it is enabled on the same terms as Run.
   */
  function updateRehearseButton(runDisabled) {
    const button = byId(ELEMENT_IDS.rehearse);
    if (!button) return;
    const dev = devLogGate.enabled();
    button.hidden = !dev;
    button.disabled = !dev || runDisabled;
  }

  /** Re-evaluate the button when the restore releases the busy hold. */
  function watchRestore() {
    if (state.watching) return;
    const restorer =
      typeof window.getMathPixSessionRestorer === "function"
        ? window.getMathPixSessionRestorer()
        : null;
    const busyButton = restorer && restorer.elements && restorer.elements.manageImagesBtn;
    if (!busyButton) return;
    state.watching = true;
    new MutationObserver(updateRunButton).observe(busyButton, {
      attributes: true,
      attributeFilter: ["disabled"],
    });
  }

  // ==========================================================================
  // THE RUN (S6-3c)
  // ==========================================================================

  /** Wait until no dialog is open, then for the focus move to settle. */
  async function whenModalsClear() {
    const deadline = performance.now() + MODAL_CLEAR_MAX_MS;
    while (
      document.querySelectorAll("dialog[open]").length > 0 &&
      performance.now() < deadline
    ) {
      await sleep(MODAL_CLEAR_POLL_MS);
    }
    if (document.querySelectorAll("dialog[open]").length > 0) {
      logWarn("whenModalsClear: a dialog stayed open; writing the line anyway");
    }
    await sleep(ANNOUNCE_SETTLE_MS);
  }

  /** AT-2: empty the correction diff and hide it, at the start of a run. */
  function clearCorrectionDiff() {
    const details = byId(ELEMENT_IDS.diff);
    const body = byId(ELEMENT_IDS.diffBody);
    if (body) body.replaceChildren();
    if (details) {
      details.open = false;
      details.hidden = true;
    }
  }

  /**
   * AT-2 (AI-D3): show what an APPLIED correction changed, read-only, in the
   * enhancer's own diff markup (one list for each side). The details stays
   * collapsed. A refused or skipped correction never reaches this.
   */
  function showCorrectionDiff(enhancer) {
    const details = byId(ELEMENT_IDS.diff);
    const body = byId(ELEMENT_IDS.diffBody);
    if (!details || !body || !enhancer || typeof enhancer.renderDiffHighlighted !== "function") {
      return;
    }
    body.replaceChildren();
    DIFF_SIDES.forEach((side) => {
      const caption = document.createElement("p");
      caption.textContent = side.caption;
      const holder = document.createElement("div");
      body.append(caption, holder);
      enhancer.renderDiffHighlighted(holder, side.mode);
    });
    details.open = false;
    details.hidden = false;
  }

  /**
   * One line into the tab's own polite region (each line REPLACES the last).
   * RP-D2: a line lands at least LINE_GAP_MS after the run's previous one.
   * RP-D4: the step cards show every outcome, so nothing else is written here.
   */
  async function speak(text) {
    await whenModalsClear();
    if (state.lastLineAt !== null) {
      const wait = state.lastLineAt + LINE_GAP_MS - performance.now();
      if (wait > 0) await sleep(wait);
    }
    setText(byId(ELEMENT_IDS.announce), text);
    state.lastLineAt = performance.now();
  }

  /** AT-1: the status paragraph carries plain text and is moved to by focus, never live. */
  function showStatus(text) {
    const status = byId(ELEMENT_IDS.status);
    if (!status) return;
    if (status.textContent !== text) status.textContent = text;
    status.hidden = false;
  }

  /** AT-1: after the confirm has closed, put focus on the status paragraph. */
  async function focusStatusAfterClose() {
    await whenModalsClear();
    const status = byId(ELEMENT_IDS.status);
    if (status && !status.hidden) status.focus();
  }

  // ==========================================================================
  // RP-1: THE LOCK, THE CARD STATUS LINES AND THE TICKER
  // ==========================================================================

  /**
   * RP-D3: for the length of a run the MMD editor is read-only (never
   * disabled, so it keeps its place in the Tab order and reads as read-only)
   * and Save File and Convert are disabled. Returns the release, which puts
   * back exactly the state each control had; run() calls it in its finally.
   * The Run button is held by state.running (updateRunButton).
   */
  function lockDocument() {
    const restores = [];
    const editor = byId(ELEMENT_IDS.editor);
    if (editor) {
      const wasReadOnly = editor.readOnly;
      editor.readOnly = true;
      restores.push(() => {
        editor.readOnly = wasReadOnly;
      });
    }
    [ELEMENT_IDS.saveFile, ELEMENT_IDS.convert].forEach((id) => {
      const button = byId(id);
      if (!button) return;
      const wasDisabled = button.disabled;
      button.disabled = true;
      restores.push(() => {
        button.disabled = wasDisabled;
      });
    });
    return () => restores.forEach((restore) => restore());
  }

  /** "1 second", "seven seconds", "12 seconds": words below ten, digits from 10. */
  function countWords(count, singular, plural, { words }) {
    const number = words && count < NUMBER_WORDS.length ? NUMBER_WORDS[count] : String(count);
    return `${number} ${count === 1 ? singular : plural}`;
  }

  /**
   * RP-D1 (the composer, pinned by rp1-1): a whole-second duration in words.
   * Under one second: "under a second". Under a minute: the seconds, words
   * below ten ("seven seconds", "one second"), digits from 10 ("12 seconds").
   * From a minute: digits throughout, "1 minute 32 seconds", "2 minutes" (a
   * zero seconds part is dropped). Seconds are floored, never rounded up.
   */
  function durationWords(ms) {
    const totalSeconds = Math.floor(Math.max(0, Number(ms) || 0) / MS_PER_SECOND);
    if (totalSeconds === 0) return UNDER_A_SECOND_TEXT;
    if (totalSeconds < SECONDS_PER_MINUTE) {
      return countWords(totalSeconds, "second", "seconds", { words: true });
    }
    const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
    const seconds = totalSeconds % SECONDS_PER_MINUTE;
    const minutePart = countWords(minutes, "minute", "minutes", { words: false });
    if (seconds === 0) return minutePart;
    return `${minutePart} ${countWords(seconds, "second", "seconds", { words: false })}`;
  }

  /** RP-D7a: a completed row's status, "Completed in four seconds", from the one duration composer. */
  function completedText(ms) {
    return `${STATUS_WORDS.COMPLETED} ${durationWords(ms)}`;
  }

  /** The visual ticker: MM:SS of whole seconds elapsed. It stays on the running clocks only (aria-hidden). */
  function tickerText(ms) {
    const totalSeconds = Math.floor(Math.max(0, Number(ms) || 0) / MS_PER_SECOND);
    const pad = (value) => String(value).padStart(2, "0");
    return `${pad(Math.floor(totalSeconds / SECONDS_PER_MINUTE))}:${pad(totalSeconds % SECONDS_PER_MINUTE)}`;
  }

  const queueRegion = () => byId(QUEUE_IDS.region);
  const queueRow = (step) =>
    queueRegion()?.querySelector(`li[data-step="${step.key}"]`) || null;
  const queuePart = (row, selector) => (row ? row.querySelector(selector) : null);

  /** One row's status word, its data-status and its icon; an icon swap is repopulated (state-swap rule). */
  function setQueueRow(step, status, text) {
    const row = queueRow(step);
    if (!row) return;
    row.dataset.status = status;
    setText(queuePart(row, QUEUE_SELECTORS.status), text);
    const icon = queuePart(row, QUEUE_SELECTORS.icon);
    if (!icon || icon.getAttribute("data-icon") === QUEUE_ICONS[status]) return;
    icon.setAttribute("data-icon", QUEUE_ICONS[status]);
    window.IconLibrary?.populateIcons?.(icon);
  }

  /** The row's aria-hidden running clock; an empty text clears it. */
  function setRowClock(step, text) {
    setText(queuePart(queueRow(step), QUEUE_SELECTORS.clock), text);
  }

  /** The total's clock is aria-hidden while it runs (running = true) and plain status text once it stops. */
  function setTotalClock(text, { running }) {
    const clock = byId(QUEUE_IDS.totalClock);
    if (!clock) return;
    setText(clock, text);
    if (running) clock.setAttribute("aria-hidden", "true");
    else clock.removeAttribute("aria-hidden");
  }

  /** The one interval: the running step's clock and the total, both from Date.now(). */
  function tickQueue() {
    const now = Date.now();
    if (state.runningStep) setRowClock(state.runningStep, tickerText(now - state.stepStartedAt));
    if (state.runningPicture) {
      setText(state.runningPicture.querySelector(QUEUE_SELECTORS.clock), tickerText(now - state.pictureStartedAt));
    }
    setTotalClock(tickerText(now - state.runStartedAt), { running: true });
  }

  function stopTicker() {
    if (state.ticker !== null) {
      clearInterval(state.ticker);
      state.ticker = null;
    }
    state.runningStep = null;
    state.runningPicture = null;
  }

  /** "three images to do" for the pictures row (the count the estimate and the hint use). */
  function imagesToDoText() {
    return `${countWords(uncoveredPictures().length, "image", "images", { words: true })} to do`;
  }

  /** RP-3c: "three images to do, one done" while running, "three images done" at the end (words below ten). */
  function picturesCountText(total, done, { finished }) {
    const doneText = countWords(done, "image", "images", { words: true });
    if (finished) return `${doneText} done`;
    return `${countWords(total, "image", "images", { words: true })} to do, ${NUMBER_WORDS[done] || String(done)} done`;
  }

  /** RP-3c: "Picture 3 of 11: leyden-jar.png", or "Picture 3 of 11" when the entry carries no file name. */
  function pictureLabel(entry, index, total) {
    const name = PICTURE_NAME_FIELDS.map((field) => entry && entry[field]).find(
      (value) => typeof value === "string" && value.trim() !== "",
    );
    const base = `Picture ${index + 1} of ${total}`;
    return name ? `${base}: ${name.trim()}` : base;
  }

  /**
   * RP-3c: a picture sub-row's status and word from the runner's report. Starting
   * reads Started; settled reads Completed in plus the words form (from the picture's own
   * elapsed time) or Failed. The runner gives the outcome word and no reason.
   */
  function pictureRowStatus(progress, elapsedMs) {
    const runner = window.MathPixAltTextBatchRunner;
    if (progress.phase === runner.PHASE.STARTING) {
      return { status: "started", text: STATUS_WORDS.STARTED };
    }
    if (progress.outcome === runner.OUTCOME.GENERATED) {
      return { status: "completed", text: completedText(elapsedMs) };
    }
    return { status: "failed", text: STATUS_WORDS.FAILED };
  }

  /** RP-3c: one Waiting sub-row for a picture. */
  function makePictureItem(label) {
    const item = document.createElement("li");
    item.className = "resume-progress-item";
    item.dataset.status = "waiting";
    item.innerHTML =
      '<div class="mathpix-progress-item">' +
      '<span class="mathpix-progress-icon" aria-hidden="true" data-icon="hourglass"></span>' +
      '<span class="mathpix-progress-label"></span>' +
      '<span class="sr-only ai-queue-sep">, </span>' +
      '<span class="mathpix-progress-status"></span>' +
      '<span class="ai-queue-clock" aria-hidden="true"></span>' +
      "</div>";
    setText(item.querySelector(".mathpix-progress-label"), label);
    setText(item.querySelector(QUEUE_SELECTORS.status), STATUS_WORDS.WAITING);
    return item;
  }

  /** RP-3c: put the sub-rows in the pictures row's nested list and show the count. */
  function placePictureRows(items) {
    const row = queueRow(STEPS[2]);
    const sublist = queuePart(row, QUEUE_SELECTORS.sublist);
    if (!sublist) return;
    state.pictureItems = items;
    state.pictureTotal = items.length;
    state.runningPicture = null;
    state.picturesDone = 0;
    sublist.replaceChildren(...items);
    window.IconLibrary?.populateIcons?.(sublist);
    setText(queuePart(row, QUEUE_SELECTORS.detail), picturesCountText(items.length, 0, { finished: false }));
  }

  /** RP-3c: one sub-row per target picture, all Waiting, built when the pictures step starts. */
  function buildPictureRows() {
    const targets = uncoveredPictures();
    placePictureRows(targets.map((entry, index) => makePictureItem(pictureLabel(entry, index, targets.length))));
  }

  /** RP-3c: a picture sub-row's status word, data-status and icon (the state-swap rule: repopulate). */
  function setPictureRow(item, status, text) {
    item.dataset.status = status;
    setText(item.querySelector(QUEUE_SELECTORS.status), text);
    const icon = item.querySelector(QUEUE_SELECTORS.icon);
    if (!icon || icon.getAttribute("data-icon") === QUEUE_ICONS[status]) return;
    icon.setAttribute("data-icon", QUEUE_ICONS[status]);
    window.IconLibrary?.populateIcons?.(icon);
  }

  /**
   * RP-3c: the runner's per-picture report, via describeAllImages onPicture.
   * A sub-row is found by the report's position, not its id, because the
   * registry can be rebuilt between the step starting and the batch (a new id
   * for the same picture). If the runner's total is not the count built, the
   * rows are rebuilt to the runner's total. Static text only; nothing spoken.
   */
  function onPicture(progress) {
    if (!progress || !Number.isInteger(progress.index)) return;
    if (progress.total !== state.pictureItems.length) {
      placePictureRows(
        Array.from({ length: progress.total }, (_, index) => makePictureItem(pictureLabel(null, index, progress.total))),
      );
    }
    const item = state.pictureItems[progress.index];
    if (!item) return;
    const starting = progress.phase === window.MathPixAltTextBatchRunner.PHASE.STARTING;
    if (starting) {
      state.runningPicture = item;
      state.pictureStartedAt = Date.now();
      // RP-3d: a Cancel pressed before the batch existed takes hold at the first picture
      if (state.cancelRequested) window.cancelDescribeAllImages?.();
    }
    const { status, text } = pictureRowStatus(progress, Date.now() - state.pictureStartedAt);
    setPictureRow(item, status, text);
    setText(item.querySelector(QUEUE_SELECTORS.clock), starting ? tickerText(0) : "");
    if (starting) return;
    state.runningPicture = null;
    if (status === "completed") state.picturesDone += 1;
    setText(
      queuePart(queueRow(STEPS[2]), QUEUE_SELECTORS.detail),
      picturesCountText(state.pictureTotal, state.picturesDone, { finished: false }),
    );
  }

  /**
   * At a run's start: the queue is shown, every ticked step has a row reading
   * Waiting, every other row is hidden, the total reads 00:00 and the one
   * interval starts. The previous run's rows are overwritten here and only here.
   */
  function resetQueue(steps) {
    stopTicker();
    const region = queueRegion();
    if (region) region.hidden = false;
    STEPS.forEach((step) => {
      const row = queueRow(step);
      if (!row) return;
      const ticked = steps.includes(step);
      row.hidden = !ticked;
      setQueueRow(step, "waiting", ticked ? STATUS_WORDS.WAITING : "");
      setRowClock(step, "");
      queuePart(row, QUEUE_SELECTORS.sublist)?.replaceChildren();
      if (step.key === "pictures") {
        state.pictureItems = [];
        state.runningPicture = null;
        state.picturesDone = 0;
      }
      setText(
        queuePart(row, QUEUE_SELECTORS.detail),
        step.key === "pictures" && ticked ? imagesToDoText() : "",
      );
    });
    setText(byId(QUEUE_IDS.done), "");
    state.runStartedAt = Date.now();
    setTotalClock(tickerText(0), { running: true });
    state.ticker = setInterval(tickQueue, TICK_MS);
  }

  /** "Started" on the row, and its MM:SS clock counting from startedAt. */
  function startStepStatus(step, startedAt) {
    state.stepStartedAt = startedAt;
    state.runningStep = step;
    setQueueRow(step, "started", STATUS_WORDS.STARTED);
    setRowClock(step, tickerText(0));
  }

  /**
   * The row's status when its step ends, as { status, text }: Completed in
   * (the words form), Failed or Skipped, or a refused step's own line alone (RP-D4: it
   * already says it was not applied).
   */
  function endRowStatus(outcome, elapsedMs) {
    if (outcome.cancelled) return { status: "cancelled", text: STATUS_WORDS.CANCELLED };
    if (outcome.skipped) return { status: "skipped", text: `${STATUS_WORDS.SKIPPED}: ${outcome.line}` };
    if (outcome.threw) return { status: "failed", text: `${STATUS_WORDS.FAILED}: ${outcome.line}` };
    if (!outcome.ok) return { status: "refused", text: upperFirst(outcome.line) };
    return { status: "completed", text: completedText(elapsedMs) };
  }

  /** The step ended: its row takes its end status and its running clock goes. */
  function endStepStatus(step, outcome, elapsedMs) {
    state.runningStep = null;
    const { status, text } = endRowStatus(outcome, elapsedMs);
    setQueueRow(step, status, text);
    setRowClock(step, "");
    if (step.key === "pictures" && state.pictureItems.length > 0) {
      // RP-3d: a cancelled run keeps the "N images to do, K done" form, and the pictures never reached read Not run
      setText(queuePart(queueRow(step), QUEUE_SELECTORS.detail), picturesCountText(state.pictureTotal, state.picturesDone, { finished: !outcome.cancelled }));
      if (outcome.cancelled) {
        state.pictureItems
          .filter((item) => item.dataset.status === "waiting")
          .forEach((item) => setPictureRow(item, "notrun", STATUS_WORDS.NOT_RUN));
      }
    }
  }

  /** RP-3d: a step the run never reached reads Not run, with no clock. */
  function markStepNotRun(step) {
    setQueueRow(step, "notrun", STATUS_WORDS.NOT_RUN);
    setRowClock(step, "");
  }

  /** The last step ended: the total stops and becomes status text. */
  function endQueue() {
    stopTicker();
    // RP-D7a: once it stops, the total reads in words ("Total 28 seconds"); MM:SS is for the running clock only
    setTotalClock(durationWords(Date.now() - state.runStartedAt), { running: false });
  }

  const upperFirst = (text) => text.charAt(0).toUpperCase() + text.slice(1);

  /**
   * RP-D2: the spoken line for one step end, "MMD correction finished in
   * twelve seconds." and then the step's own outcome sentence. A step that
   * never ran keeps today's "<step>: skipped, <reason>." (it has no duration).
   */
  function stepEndLine(step, outcome, elapsedMs) {
    if (outcome.skipped) return `${step.label}: ${outcome.line}`;
    // M-5y: a step whose request got no reply has no duration worth saying (a cut says "four minutes" for a failure)
    if (outcome.noReply) return `${step.label} did not finish. ${upperFirst(outcome.line)}`;
    return `${step.label} finished in ${durationWords(elapsedMs)}. ${upperFirst(outcome.line)}`;
  }

  /** AT-1: after a Cancel, focus is on the Run button, which is enabled. */
  async function focusRunAfterClose() {
    await whenModalsClear();
    const run = byId(ELEMENT_IDS.run);
    if (run && !run.disabled && document.activeElement !== run) run.focus();
  }

  // ==========================================================================
  // THE DEV-ONLY AI RUN LOG (AT-4, ruling AI-D5)
  // ==========================================================================
  // A run records, per step, what each send carried and what came back, so a
  // tester can save it and a rig can replay it. Dev mode only: an ordinary
  // user's run installs nothing and the button never appears. Held in memory
  // ONLY (state.log); a reload loses it. Two seams, both on objects the tab
  // does not own and both restored when the run ends: the embed's
  // sendRequest (the request the step built and the parsed reply) and the
  // page's fetch (the wire body and raw reply, when a send reaches the wire;
  // a stubbed send never does). No shared file is edited.

  /** The gate. Held on an object so a guard row can replace it and drive both branches. */
  const devLogGate = {
    enabled: () => window.MathPixAIEnhancer?.devHarnessGate?.enabled?.() === true,
  };

  /** A copy of `value` with every credential-keyed field replaced. */
  function scrubValue(value, key) {
    if (typeof key === "string" && SECRET_KEY_PATTERN.test(key)) return REMOVED_TEXT;
    if (Array.isArray(value)) return value.map((item) => scrubValue(item));
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, scrubValue(v, k)]),
      );
    }
    return value;
  }

  /** Parsed JSON where the text is JSON (scrubbed), else the text itself. */
  function scrubBody(body) {
    if (typeof body !== "string") return body == null ? null : "[non-text body]";
    try {
      return scrubValue(JSON.parse(body));
    } catch (error) {
      return body;
    }
  }

  /** The request headers as a plain lower-case object, with the credential values noted. */
  function readHeaders(input, init, secrets) {
    const out = {};
    let headers;
    try {
      headers = new Headers((init && init.headers) || (input && input.headers) || {});
    } catch (error) {
      return out;
    }
    headers.forEach((value, name) => {
      if (SECRET_KEY_PATTERN.test(name)) {
        secrets.add(value);
        secrets.add(value.replace(/^bearer\s+/i, ""));
        out[name] = REMOVED_TEXT;
      } else {
        out[name] = value;
      }
    });
    return out;
  }

  /** The URL with credential-keyed query parameters replaced. */
  function scrubUrl(input) {
    const raw = typeof input === "string" ? input : (input && input.url) || String(input);
    try {
      const url = new URL(raw, window.location.href);
      [...url.searchParams.keys()].forEach((name) => {
        if (SECRET_KEY_PATTERN.test(name)) url.searchParams.set(name, REMOVED_TEXT);
      });
      return url.toString();
    } catch (error) {
      return raw;
    }
  }

  /** What a send's parsed reply keeps: text, stop reasons, model, token counts. */
  function summariseResponse(response) {
    if (!response) return null;
    const usage = response.raw && response.raw.usage ? response.raw.usage : null;
    const tokens = response.metadata && response.metadata.tokens;
    const text = typeof response.text === "string" ? response.text : null;
    return {
      text,
      textChars: text === null ? null : text.length,
      finishReason: response.finishReason ?? null,
      nativeFinishReason: response.nativeFinishReason ?? null,
      model: (response.metadata && response.metadata.model) || (response.raw && response.raw.model) || null,
      usage: usage
        ? scrubValue(usage)
        : tokens
          ? { prompt_tokens: tokens.prompt, completion_tokens: tokens.completion, total_tokens: tokens.total }
          : null,
    };
  }

  /** Which guards a refused correction tripped, named as the enhancer names them. */
  function guardsFor(step, outcome, sends) {
    if (step.key !== "correction" || outcome.ok || outcome.skipped) return [];
    const Enhancer = window.MathPixAIEnhancer;
    if (!Enhancer) return [];
    const first = sends.find((send) => send.response);
    const reply = first && first.response;
    if (outcome.line === Enhancer.INCOMPLETE_REPLY_LINE) {
      const cut = Enhancer.isProviderCutReply(reply || {});
      return [{ name: cut.cut ? "length" : "ratio", line: outcome.line }];
    }
    const original = window.getMathPixAIEnhancer?.()?.originalMMD;
    if (!reply || typeof reply.text !== "string" || typeof original !== "string") return [];
    const pictures = Enhancer.findLostPictures(original, reply.text);
    if (!pictures.lost || pictures.line !== outcome.line) return [];
    const guards = [];
    if (pictures.missingUrls.some((url) => !url.endsWith("(alt text removed)"))) {
      guards.push({ name: "CR-1", line: outcome.line });
    }
    if (pictures.missingUrls.some((url) => url.endsWith("(alt text removed)"))) {
      guards.push({ name: "CR-1c", line: outcome.line });
    }
    return guards;
  }

  /** A recorder for one run: installs the two seams and fills `doc`. */
  function createRunRecorder(steps) {
    const secrets = new Set();
    SECRET_STORAGE_KEYS.forEach((key) => {
      try {
        const value = window.localStorage.getItem(key);
        if (value) secrets.add(value);
      } catch (error) {
        logWarn("run log: storage unreadable for a secret sweep", error);
      }
    });
    const startedAt = new Date().toISOString();
    const doc = {
      schema: RUN_LOG_SCHEMA,
      mode: "ui-run-log",
      runId: `ai-run-${startedAt.replace(/[:.]/g, "-")}`,
      startedAt,
      finishedAt: null,
      pdf: pdfBaseName(),
      provider: activeProviderId(),
      models: [],
      stepsTicked: steps.map((step) => step.key),
      note: "Held in memory only and written on request; a reload loses it. Secrets are replaced with [removed].",
      steps: [],
    };
    const rec = { doc, secrets, active: true, step: null, send: null, entry: null, pending: [], undo: [] };

    rec.beginStep = (step) => {
      let modelId = null;
      try {
        modelId = resolvedModelId(step);
      } catch (error) {
        logWarn("run log: model id unreadable", error);
      }
      rec.entry = {
        step: step.key,
        label: step.label,
        provider: activeProviderId(),
        model: modelId,
        startedAt: new Date().toISOString(),
        endedAt: null,
        durationMs: null,
        sends: [],
        unattachedWire: [],
        cost: null,
        outcome: null,
        guards: [],
      };
      rec.stepStart = performance.now();
      doc.steps.push(rec.entry);
    };

    rec.endStep = async (step, outcome) => {
      const entry = rec.entry;
      if (!entry) return;
      await Promise.allSettled(rec.pending.splice(0));
      entry.endedAt = new Date().toISOString();
      entry.durationMs = Math.round(performance.now() - rec.stepStart);
      entry.outcome = { ok: outcome.ok, skipped: outcome.skipped, line: outcome.line };
      entry.guards = guardsFor(step, outcome, entry.sends);
      const costs = entry.sends
        .map((send) => send.response && send.response.usage && send.response.usage.cost)
        .filter((cost) => typeof cost === "number");
      entry.cost = costs.length > 0 ? costs.reduce((a, b) => a + b, 0) : null;
      rec.entry = null;
    };

    rec.beginSend = (embed, userPrompt) => {
      if (!rec.entry) return null;
      const send = {
        startedAt: new Date().toISOString(),
        endedAt: null,
        durationMs: null,
        request: {
          model: embed.model ?? null,
          systemPrompt: embed.systemPrompt ?? null,
          userPrompt: typeof userPrompt === "string" ? userPrompt : null,
          temperature: embed.temperature ?? null,
          max_tokens: embed.max_tokens ?? null,
          top_p: embed.top_p ?? null,
        },
        wire: [],
        response: null,
        error: null,
        t0: performance.now(),
      };
      rec.entry.sends.push(send);
      rec.send = send;
      return send;
    };

    rec.endSend = (send, response, error) => {
      if (!send) return;
      send.endedAt = new Date().toISOString();
      send.durationMs = Math.round(performance.now() - send.t0);
      delete send.t0;
      send.response = summariseResponse(response);
      send.error = error ? String((error && error.message) || error) : null;
      if (rec.send === send) rec.send = null;
    };

    rec.beginWire = (input, init) => {
      if (!rec.entry) return null;
      const item = {
        url: scrubUrl(input),
        method: String((init && init.method) || (input && input.method) || "GET").toUpperCase(),
        headers: readHeaders(input, init, secrets),
        body: scrubBody(init && init.body),
        status: null,
        responseBody: null,
        error: null,
      };
      (rec.send ? rec.send.wire : rec.entry.unattachedWire).push(item);
      return item;
    };

    rec.endWire = (item, response) => {
      if (!item || !response) return;
      item.status = response.status;
      const type = (response.headers && response.headers.get("content-type")) || "";
      if (/event-stream/i.test(type)) {
        item.responseBody = "[stream not recorded]";
        return;
      }
      try {
        rec.pending.push(
          response
            .clone()
            .text()
            .then((text) => {
              item.responseBody = scrubBody(text.slice(0, WIRE_BODY_MAX_CHARS));
            }),
        );
      } catch (error) {
        item.responseBody = "[unreadable]";
      }
    };

    // Seam 1: the embed's sendRequest, on the prototype, so every instance a step mints is seen.
    const proto = window.OpenRouterEmbed && window.OpenRouterEmbed.prototype;
    if (proto && typeof proto.sendRequest === "function") {
      const own = Object.prototype.hasOwnProperty.call(proto, "sendRequest");
      const real = proto.sendRequest;
      const wrapper = async function (...args) {
        const send = rec.active ? rec.beginSend(this, args[0]) : null;
        try {
          const response = await real.apply(this, args);
          rec.endSend(send, response, null);
          return response;
        } catch (error) {
          rec.endSend(send, null, error);
          throw error;
        }
      };
      proto.sendRequest = wrapper;
      rec.undo.push(() => {
        if (proto.sendRequest !== wrapper) return;
        if (own) proto.sendRequest = real;
        else delete proto.sendRequest;
      });
    }

    // Seam 2: the page's fetch. POSTs only; a clone of the reply is read, the caller's is untouched.
    const realFetch = window.fetch;
    if (typeof realFetch === "function") {
      const fetchWrapper = function (input, init) {
        const method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
        if (!rec.active || method !== "POST") return realFetch.apply(this, arguments);
        const item = rec.beginWire(input, init);
        return realFetch.apply(this, arguments).then(
          (response) => {
            rec.endWire(item, response);
            return response;
          },
          (error) => {
            if (item) item.error = String((error && error.message) || error);
            throw error;
          },
        );
      };
      window.fetch = fetchWrapper;
      rec.undo.push(() => {
        if (window.fetch === fetchWrapper) window.fetch = realFetch;
      });
    }

    return rec;
  }

  /** Stop recording, restore both seams, and keep the finished log for the button. */
  function finishRunLog(rec) {
    if (!rec) return;
    rec.active = false;
    rec.undo.splice(0).reverse().forEach((undo) => undo());
    rec.doc.finishedAt = new Date().toISOString();
    rec.doc.models = [
      ...new Set(
        rec.doc.steps.filter((entry) => entry.model).map((entry) => `${entry.provider}:${entry.model}`),
      ),
    ];
    state.log = rec.doc;
    state.logSecrets = rec.secrets;
    updateSaveLogButton();
  }

  /** The button shows only in dev mode and only once a run has finished. */
  function updateSaveLogButton() {
    const button = byId(ELEMENT_IDS.saveLog);
    if (!button) return;
    button.hidden = !(devLogGate.enabled() && state.log);
  }

  /** The PDF's name without its extension, safe in a file name. */
  function pdfBaseName() {
    const restorer =
      typeof window.getMathPixSessionRestorer === "function"
        ? window.getMathPixSessionRestorer()
        : null;
    const name = String(restorer?.restoredSession?.source?.filename || "");
    const base = name
      .replace(/\.[A-Za-z0-9]+$/, "")
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return base || RUN_LOG_FALLBACK_BASE;
  }

  /** The log as JSON text, with every noted secret swept out of the whole text. */
  function serialiseRunLog(doc, secrets) {
    let text = JSON.stringify(doc, null, 2);
    [...secrets]
      .filter((secret) => typeof secret === "string" && secret.length >= MIN_SECRET_SWEEP_CHARS)
      .forEach((secret) => {
        text = text.split(secret).join(REMOVED_TEXT);
      });
    return text;
  }

  /** Download the last run's log through the downloader's own trigger. Resolves {filename, blob}, or null. */
  function saveRunLog() {
    if (!state.log || !devLogGate.enabled()) return null;
    const text = serialiseRunLog(state.log, state.logSecrets || new Set());
    const blob = new Blob([text], { type: "application/json" });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${state.log.pdf}-${RUN_LOG_FILE_SUFFIX}-${stamp}.json`;
    const downloader = window.MathPixTotalDownloader;
    if (!downloader || !downloader.prototype || typeof downloader.prototype.triggerDownload !== "function") {
      logError("run log: no downloader to hand the file to");
      return null;
    }
    downloader.prototype.triggerDownload.call(null, blob, filename);
    return { filename, blob };
  }

  const lowerFirst = (text) => text.charAt(0).toLowerCase() + text.slice(1);

  /** What a step ends with: ok, the sentence it returned, and whether it never ran. */
  const outcomeOf = (ok, line, skipped) => ({
    ok,
    skipped: skipped === true,
    line: typeof line === "string" && line ? line : NO_LINE_TEXT,
  });

  /** RP-3d: a step the person stopped. Not ok, not a failure; `line` is the step's own words, if it has any. */
  const cancelledOutcome = (line) => ({ ...outcomeOf(false, line), cancelled: true });

  /** RP-3d: how each step is stopped. Each returns whether a run was there to stop. */
  const CANCELLERS = Object.freeze({
    correction: () => window.getMathPixAIEnhancer?.()?.cancelQuietRun?.() === true,
    context: () => window.MathPixContextAI?.cancelQuietRun?.() === true,
    pictures: () => window.cancelDescribeAllImages?.() === true,
  });

  /** M-5y: whether a correction's line is one of the enhancer's two sentences for a request that got no reply. */
  function isNoReplyLine(line) {
    const enhancer = window.MathPixAIEnhancer;
    if (!enhancer || typeof line !== "string") return false;
    return line === enhancer.PROXY_CUT_LINE || line === enhancer.SERVICE_UNREACHABLE_LINE;
  }

  const RUNNERS = Object.freeze({
    correction: async () => {
      const enhancer = window.getMathPixAIEnhancer?.();
      if (!enhancer) return outcomeOf(false, null);
      const result = await enhancer.runCorrection({ apply: true });
      if (result && result.cancelled) return cancelledOutcome();
      if (result && result.applied) showCorrectionDiff(enhancer);
      const outcome = outcomeOf(Boolean(result && result.applied), result && result.line);
      // M-5y: the outcome carries no marker for "the request got no reply", so it is read off the line: the enhancer
      // publishes the two sentences it gives a bare fetch failure, and a refusal that did get a reply never equals them
      const noReply = !outcome.ok && isNoReplyLine(result && result.line);
      return noReply ? { ...outcome, noReply: true } : outcome;
    },
    context: async () => {
      const result = await window.MathPixContextAI?.handleAnalyseClick({
        quiet: true,
      });
      if (result && result.cancelled) return cancelledOutcome();
      return outcomeOf(Boolean(result && result.filled), result && result.line);
    },
    pictures: async () => {
      // RP-1: the manager stays closed, so no dialog opens mid-run and the
      // tab's own region stays exposed for every step's line.
      const options = { quiet: true, openManager: false, onPicture };
      buildPictureRows();
      const chosenId = chosenIdFor(STEPS[2], null);
      if (chosenId) options.model = chosenId;
      if (redescribeOn()) options.includeDescribed = true;
      const result = await window.describeAllImages(options);
      // a Cancel that came after the last picture left nothing untouched: the step ran in full
      if (result && result.cancelled && result.remaining > 0) return cancelledOutcome(result.line);
      return outcomeOf(
        Boolean(result && result.ran && result.generated > 0),
        result && result.line,
      );
    },
  });

  /**
   * RP-5 (RP-D9): the stand-ins a rehearsal runs in place of RUNNERS. They take REHEARSAL_STEP_MS a
   * step and REHEARSAL_PICTURE_MS a picture, return the real outcome shapes, and touch nothing: no
   * provider, embed, network, MMD, context store or registry. Cancel is the real flag
   * (state.cancelRequested): a correction or context stand-in stops within a slice, and the pictures
   * stand-in finishes the picture in hand, as the real batch does.
   */
  async function rehearsalWait(ms) {
    const end = Date.now() + ms;
    while (Date.now() < end && !state.cancelRequested) {
      await sleep(Math.min(REHEARSAL_SLICE_MS, Math.max(0, end - Date.now())));
    }
  }

  const rehearsalStep = (key) => async () => {
    await rehearsalWait(REHEARSAL_STEP_MS);
    if (state.cancelRequested) return cancelledOutcome();
    return outcomeOf(true, REHEARSAL_STEP_LINES[key]);
  };

  const REHEARSAL_RUNNERS = Object.freeze({
    correction: rehearsalStep("correction"),
    context: rehearsalStep("context"),
    pictures: async () => {
      const runner = window.MathPixAltTextBatchRunner;
      // the same rows and the same targets (the estimate's partition) as the real step
      buildPictureRows();
      const targets = uncoveredPictures();
      for (let index = 0; index < targets.length; index += 1) {
        if (state.cancelRequested) {
          const done = countWords(index, "picture", "pictures", { words: true });
          return cancelledOutcome(`stopped after ${done}, ${REHEARSAL_STEP_LINES.pictures}`);
        }
        const report = { index, total: targets.length, id: targets[index] && targets[index].id };
        onPicture({ ...report, phase: runner.PHASE.STARTING });
        await sleep(REHEARSAL_PICTURE_MS);
        onPicture({ ...report, phase: runner.PHASE.SETTLED, outcome: runner.OUTCOME.GENERATED });
      }
      return outcomeOf(targets.length > 0, REHEARSAL_STEP_LINES.pictures);
    },
  });

  /** RP-5: a spoken line of a rehearsal ends with its clause; a real run's line is untouched. */
  const rehearsalLine = (text) => (state.rehearsal ? `${text} ${REHEARSAL_LINE_CLAUSE}` : text);

  /** Run one step, or skip it if its precondition no longer holds. */
  async function runStep(step, recorder = null) {
    if (recorder) recorder.beginStep(step);
    const finished = async (outcome) => {
      if (recorder) await recorder.endStep(step, outcome);
      return outcome;
    };
    const reason = reasonFor(step);
    if (reason) {
      const detail = `${lowerFirst(reason)}`;
      return finished({ ...outcomeOf(false, `skipped, ${detail}`, true), detail });
    }
    try {
      const outcome = await (state.rehearsal ? REHEARSAL_RUNNERS : RUNNERS)[step.key]();
      return finished({ ...outcome, detail: outcome.line });
    } catch (error) {
      logError(`runStep(${step.key}) threw`, error);
      const outcome = outcomeOf(false, THREW_TEXT);
      return finished({ ...outcome, threw: true, detail: outcome.line });
    }
  }

  /**
   * "Done: 3 of 3 steps ran." A step that returned its own refusal line (RP-D4a)
   * follows the count with that line alone: "Done: 2 of 3 steps ran. <line>".
   * A skipped or thrown step keeps "Done: 2 of 3; <step> was not applied: <line>".
   */
  function finalLine(results, { spoken = false } = {}) {
    const ran = results.filter((entry) => entry.outcome.ok).length;
    const missed = results.filter((entry) => !entry.outcome.ok);
    if (missed.length === 0) return `Done: ${ran} of ${results.length} steps ran.`;
    if (missed.every((entry) => !entry.outcome.skipped && !entry.outcome.threw)) {
      // M-5y: the spoken line already carried a no-reply step's sentence at that step's end, so it is not said again
      const details = missed
        .filter((entry) => !(spoken && entry.outcome.noReply))
        .map((entry) => entry.outcome.detail);
      const count = `Done: ${ran} of ${results.length} steps ran.`;
      return details.length > 0 ? `${count} ${details.join(" ")}` : count;
    }
    const named = missed.map(
      (entry) =>
        `${entry.step.label} was ${entry.outcome.skipped ? "skipped" : "not applied"}: ${entry.outcome.detail.replace(/\.$/, "")}`,
    );
    return `Done: ${ran} of ${results.length}; ${named.join("; ")}.`;
  }

  /**
   * RP-3d (RP-D6): the one spoken line, and the queue's Done paragraph, for a run
   * the person stopped: "Cancelled. 1 of 3 steps ran." then the line of each step
   * that ran (a cancelled pictures step keeps its own count of what it wrote).
   */
  function cancelLine(results, total) {
    const ran = results.filter((entry) => entry.outcome.ok).length;
    const kept = results
      .filter((entry) => entry.outcome.ok || (entry.outcome.cancelled && entry.step.key === "pictures" && state.picturesDone > 0))
      .map((entry) =>
        entry.outcome.cancelled
          ? `${entry.step.label}: ${upperFirst(entry.outcome.line)}`
          : stepEndLine(entry.step, entry.outcome, entry.elapsedMs),
      );
    return [`Cancelled. ${ran} of ${total} steps ran.`, ...kept].join(" ");
  }

  /** RP-3d: hide Cancel; if it holds focus, hand focus to the status paragraph (or Run) first, never to the body. */
  function hideCancelButton() {
    const cancel = byId(ELEMENT_IDS.cancel);
    if (!cancel) return;
    if (document.activeElement === cancel) {
      const status = byId(ELEMENT_IDS.status);
      const target = status && !status.hidden ? status : byId(ELEMENT_IDS.run);
      if (target) target.focus();
    }
    cancel.hidden = true;
  }

  /**
   * RP-3d: the Cancel button's handler. Does nothing unless the steps are being
   * run and Cancel has not already been pressed. Focus moves to the status
   * paragraph, reading "Cancelling.", before the button hides. Then the running
   * step is stopped; the loop in run() does the rest.
   */
  function cancelRun() {
    if (!state.runActive || state.cancelRequested) return false;
    state.cancelRequested = true;
    showStatus(CANCELLING_TEXT);
    byId(ELEMENT_IDS.status)?.focus();
    hideCancelButton();
    const step = state.runningStep;
    if (step) {
      // RP-5: a rehearsal has no real run to stop; its stand-ins read state.cancelRequested
      if (!state.rehearsal) CANCELLERS[step.key]();
      if (step.key === "pictures") setQueueRow(step, "started", STATUS_WORDS.CANCELLING);
    }
    return true;
  }

  function setRunning(running) {
    state.running = running;
    STEPS.forEach((step) => {
      const box = byId(stepId(step));
      if (box) box.disabled = running;
    });
    applyRedescribeBox();
    updateRunButton();
  }

  /**
   * The Run button's handler. One confirm; then the ticked steps in order, each
   * awaited. RP-D2: one line per step end, at least LINE_GAP_MS apart, the last
   * step's line and the final line in one write. RP-3b: each ticked step has a
   * queue row reading Waiting, Started (with its clock), then its end status;
   * the queue stays after the run and resets at the next. RP-D3: the
   * document is locked from the confirm to the end. Resolves with the
   * outcomes, or null when nothing ran.
   */
  async function run(options = {}) {
    if (state.running) return null;
    // RP-5 (RP-D9): a rehearsal is dev mode only and fails closed; it never falls back to a real run
    const rehearsal = options.rehearsal === true;
    if (rehearsal && !devLogGate.enabled()) return null;
    const steps = tickedSteps();
    if (steps.length === 0 || !restoreSettled()) return null;

    state.running = true;
    state.rehearsal = rehearsal;
    let recorder = null;
    let releaseLock = null;
    try {
      if (rehearsal) setText(byId(ELEMENT_IDS.estimate), REHEARSAL_ESTIMATE_TEXT);
      // RP-6b (RP-D10): the lead is the spoken description; the ordered list follows it
      const confirmView = confirmParts(steps, rehearsal);
      const confirmed = await window.safeConfirm(
        confirmView.lead,
        rehearsal ? REHEARSAL_TITLE : RUN_TITLE,
        {
          confirmText: CONFIRM_RUN_TEXT,
          cancelText: CONFIRM_CANCEL_TEXT,
          returnFocusTo: byId(ELEMENT_IDS.run),
          details: buildConfirmDetails(confirmView.items),
        },
      );
      if (!confirmed) {
        await focusRunAfterClose();
        return null;
      }

      // RP-4: nothing is disabled until the confirm has left the tree and focus is on the status paragraph. The
      // dialog returns focus to Run; a Run already disabled sends it to main, and the screen reader reads the page.
      // state.running (set above) already stops a second press.
      // AT-4: dev mode only. A new run replaces the last log; the button waits for this one to finish.
      // RP-5: a rehearsal writes nothing, so it keeps the last real run's log and correction diff and records nothing
      if (!rehearsal) {
        state.log = null;
        state.logSecrets = null;
      }
      recorder = !rehearsal && devLogGate.enabled() ? createRunRecorder(steps) : null;
      updateSaveLogButton();
      if (!rehearsal) clearCorrectionDiff();
      resetQueue(steps);
      // RP-5: the badge is on for a rehearsal and cleared by the next real run
      const badge = byId(ELEMENT_IDS.badge);
      if (badge) badge.hidden = !rehearsal;
      state.lastLineAt = null;
      showStatus(RUNNING_TEXT);
      await focusStatusAfterClose();
      setRunning(true);
      releaseLock = lockDocument();
      const results = [];
      // RP-3d: Cancel appears now, after focus has gone to the status paragraph, so it is next in Tab order
      state.cancelRequested = false;
      state.runActive = true;
      const cancelButton = byId(ELEMENT_IDS.cancel);
      if (cancelButton) cancelButton.hidden = false;
      for (let i = 0; i < steps.length; i += 1) {
        const step = steps[i];
        const startedAt = Date.now();
        startStepStatus(step, startedAt);
        const outcome = await runStep(step, recorder);
        const elapsedMs = Date.now() - startedAt;
        endStepStatus(step, outcome, elapsedMs);
        results.push({ step, outcome, elapsedMs });
        // RP-3d: stopped when the step itself was cancelled, or Cancel came while a step that was not the last ran
        const last = i === steps.length - 1;
        if (state.cancelRequested && (outcome.cancelled || !last)) {
          state.runActive = false;
          steps.slice(i + 1).forEach(markStepNotRun);
          endQueue();
          const stopped = cancelLine(results, steps.length);
          await speak(rehearsalLine(stopped));
          setText(byId(QUEUE_IDS.done), stopped);
          showStatus(CANCELLED_TEXT);
          return results;
        }
        if (last) {
          // the last step is over: Cancel can no longer stop anything, so it leaves (focus handed on first)
          state.runActive = false;
          hideCancelButton();
          endQueue();
        }
        const spoken = stepEndLine(step, outcome, elapsedMs);
        await speak(rehearsalLine(last ? `${spoken} ${finalLine(results, { spoken: true })}` : spoken));
      }
      // RP-3c: the status paragraph keeps "Finished." (AT-6 focus text, pinned by at6-1); the Done line is on the queue.
      setText(byId(QUEUE_IDS.done), finalLine(results));
      showStatus(FINISHED_TEXT);
      return results;
    } finally {
      state.runActive = false;
      state.cancelRequested = false;
      hideCancelButton();
      stopTicker();
      if (releaseLock) releaseLock();
      finishRunLog(recorder);
      state.running = false;
      state.rehearsal = false;
      setRunning(false);
      refresh();
    }
  }

  // ==========================================================================
  // "CHANGE THE MODEL" — a native select in a disclosure, in place (AV-1)
  // ==========================================================================
  // Each step's select is bound to the SAME stored setting as that step's own
  // workflow picker, and both directions agree: choosing here calls the setter
  // the picker calls, then asks the picker to show it; a pick made in a picker
  // is read back here on every refresh and when a dialog closes. The select
  // moves no focus and writes no live region (it speaks its own change).

  /** Setter per step: store `modelId`, and return whether it was accepted. */
  const MODEL_SETTERS = Object.freeze({
    correction: (modelId) => {
      const enhancer = window.getMathPixAIEnhancer?.();
      if (!enhancer || typeof enhancer.handleModelChange !== "function") return false;
      // handleModelChange needs no dialog (AV-1 step 1b); it stores the choice
      // in selectedModel and in the saved preferences.
      enhancer.handleModelChange(modelId);
      return true;
    },
    context: (modelId, recommendedId) => {
      const ctx = window.MathPixContextAI;
      if (!ctx || typeof ctx._setUserModelChoice !== "function") return false;
      // Choosing the recommendation clears the pick, as the picker's radio does.
      const accepted = ctx._setUserModelChoice(
        modelId === recommendedId ? null : modelId,
      );
      if (accepted && typeof ctx._syncPickerToChoice === "function") {
        ctx._syncPickerToChoice();
      }
      return accepted;
    },
    pictures: (modelId, recommendedId) => {
      const adapter = window.MathPixAltTextCloudAdapter;
      if (!adapter || typeof adapter._setUserModelChoice !== "function") return false;
      return adapter._setUserModelChoice(
        modelId === recommendedId ? null : modelId,
      );
    },
  });

  /** The capability a model needs for the step: the PDF for two, an image for pictures. */
  function canServeStep(step, modelId) {
    const capability = window.MathPixModelCapability;
    if (!capability) return true;
    const readsInput =
      step.key === "pictures"
        ? capability.isModelVisionCapable
        : capability.isModelPdfCapable;
    if (typeof readsInput === "function" && !readsInput(modelId)) return false;
    return typeof capability.isModelProviderAvailable !== "function"
      ? true
      : capability.isModelProviderAvailable(modelId);
  }

  /**
   * AV-1b: the list each step's own workflow picker offers, from the function
   * that picker builds it with (AV-D1a). Each returns an array of { id, name, ... }
   * or null when that function is not on the page.
   */
  const PICKER_LISTS = Object.freeze({
    // The correction dialog: its recommended radios, then its advanced select.
    correction: (providerId) => {
      const enhancer = window.getMathPixAIEnhancer?.();
      if (
        !enhancer ||
        typeof enhancer.getRecommendedModels !== "function" ||
        typeof enhancer.getRegistryModels !== "function"
      ) {
        return null;
      }
      const recommended = Object.values(enhancer.getRecommendedModels(providerId)).map((entry) => ({
        id: entry.id,
        name: displayNameFor(entry.id, providerId) || entry.label || entry.name || entry.id,
      }));
      const registry = enhancer.getRegistryModels();
      return [...recommended, ...registry.low, ...registry.medium, ...registry.high];
    },
    context: (providerId) => {
      const ctx = window.MathPixContextAI;
      return ctx && typeof ctx._pdfCapableModelsFor === "function"
        ? ctx._pdfCapableModelsFor(providerId)
        : null;
    },
    pictures: (providerId) => {
      const manager = window.MathPixImageManagerUI?.getInstance?.();
      return manager && typeof manager._visionCapableModelsForProvider === "function"
        ? manager._visionCapableModelsForProvider(providerId)
        : null;
    },
  });

  /** The catalogue filtered by the step's capability: the fallback when a picker's own function is absent. */
  function catalogueModelsFor(step, providerId) {
    const selector = window.EmbedModelSelector;
    let all = [];
    if (selector && typeof selector.getEligibleModels === "function") {
      try {
        all = selector.getEligibleModels({ providerId, capabilities: [] });
      } catch (error) {
        logWarn("catalogueModelsFor: getEligibleModels threw", error);
      }
    }
    return (Array.isArray(all) ? all : []).filter(
      (model) => model && typeof model.id === "string" && canServeStep(step, model.id),
    );
  }

  /**
   * Every model the step's own workflow picker offers on the active provider,
   * { id, name }. The lists cost about 200 ms each to build, so the answer is
   * kept per step and provider. Pass `fresh` to recompute.
   */
  function servableModelsFor(step, fresh) {
    const providerId = activeProviderId();
    const cacheKey = `${step.key}|${providerId}`;
    if (!fresh && state.choiceCache.has(cacheKey)) return state.choiceCache.get(cacheKey);

    let all = null;
    try {
      all = PICKER_LISTS[step.key](providerId);
    } catch (error) {
      logWarn(`servableModelsFor: the ${step.key} picker list threw`, error);
    }
    if (!Array.isArray(all)) all = catalogueModelsFor(step, providerId);

    const seen = new Set();
    const servable = all
      .filter((model) => model && typeof model.id === "string" && !seen.has(model.id) && seen.add(model.id))
      .map((model) => ({ id: model.id, name: model.name || model.id }));
    // An empty answer means the catalogue was not ready, so it is not kept.
    if (servable.length > 0) state.choiceCache.set(cacheKey, servable);
    return servable;
  }

  /**
   * True when the step's own picker does not offer `modelId` (AV-D1a). An empty
   * list says nothing about the pick (the catalogue is not loaded), so it never
   * strands one.
   */
  function isStrandedPick(step, modelId) {
    const offered = servableModelsFor(step);
    return offered.length > 0 && !offered.some((model) => model.id === modelId);
  }

  /** The models a step's select offers on the active provider: { id, name }, by name. */
  function modelChoicesFor(step, recommendedId) {
    const choices = servableModelsFor(step).slice();
    if (recommendedId && !choices.some((choice) => choice.id === recommendedId)) {
      choices.push({
        id: recommendedId,
        name: displayNameFor(recommendedId, activeProviderId()) || recommendedId,
      });
    }
    return choices.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** The model the step will use now: the stored pick, else the recommendation. */
  function storedModelFor(step) {
    const recommendedId = recommendedIdFor(step.purpose, activeProviderId());
    return chosenIdFor(step, recommendedId) || recommendedId;
  }

  /**
   * Fill and set one step's select from the stored value. The options are
   * rebuilt only when the list changes, so a refresh never disturbs a select
   * the person is using.
   */
  function applyModelSelect(step) {
    const select = byId(selectId(step));
    if (!select) return;

    // The select sits in a closed disclosure and nobody can reach it there, so
    // nothing is built until it is opened (the toggle listener calls this again).
    const details = byId(advancedId(step));
    if (details && !details.open) return;

    const recommendedId = recommendedIdFor(step.purpose, activeProviderId());
    const choices = modelChoicesFor(step, recommendedId);
    const signature = choices
      .map((choice) => `${choice.id}|${choice.id === recommendedId}`)
      .join(",");
    if (select.dataset.aiOptions !== signature) {
      // AV-D4: the registry default first, alone, in "Recommended"; the rest in "Other models".
      // The option text is the bare name, without the Foundry catalogue suffix (the bar names the
      // provider, as the model lines do), so the closed select shows it whole.
      const buildGroup = (label, members) => {
        const group = document.createElement("optgroup");
        group.label = label;
        members.forEach((choice) => {
          const option = document.createElement("option");
          option.value = choice.id;
          option.textContent = choice.name.replace(PROVIDER_NAME_SUFFIX, "");
          group.appendChild(option);
        });
        return group;
      };
      const recommended = choices.filter((choice) => choice.id === recommendedId);
      const others = choices.filter((choice) => choice.id !== recommendedId);
      const groups = [];
      if (recommended.length) groups.push(buildGroup(SELECT_GROUP_LABELS.RECOMMENDED, recommended));
      if (others.length) groups.push(buildGroup(SELECT_GROUP_LABELS.OTHER, others));
      select.replaceChildren(...groups);
      select.dataset.aiOptions = signature;
    }

    const stored = storedModelFor(step);
    if (stored && select.value !== stored) select.value = stored;
  }

  /** Lines, selects and the estimate, from the stored values. No tick state, no focus. */
  function refreshModels() {
    STEPS.forEach((step) => {
      writeModelLine(step);
      applyModelSelect(step);
    });
    updateEstimate();
    updateSummary();
  }

  /** The select changed: store it through the step's own setter, then re-read. */
  function handleModelSelect(step) {
    const select = byId(selectId(step));
    if (!select) return;
    const recommendedId = recommendedIdFor(step.purpose, activeProviderId());
    const accepted = MODEL_SETTERS[step.key](select.value, recommendedId);
    if (!accepted) logWarn(`handleModelSelect: ${step.key} refused ${select.value}`);
    logInfo("Model changed in place", { step: step.key, model: select.value, accepted });
    refreshModels();
  }

  /**
   * Re-read the stored values whenever a dialog that holds a picker has closed
   * (the correction dialog and the image manager both change the stored value).
   * Dialogs are children of the body, so one observer on it sees them go.
   */
  function watchPickerClose() {
    if (state.watchingDialogs) return;
    state.watchingDialogs = true;
    let wasOpen = Boolean(document.querySelector("dialog[open]"));
    const check = () => {
      const isOpen = Boolean(document.querySelector("dialog[open]"));
      if (wasOpen && !isOpen) refreshModels();
      wasOpen = isOpen;
    };
    // A second observe() on one observer would replace the first's options.
    new MutationObserver(check).observe(document.body, { childList: true });
    new MutationObserver(check).observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["open"],
    });
  }

  // ==========================================================================
  // WIRING
  // ==========================================================================

  function init() {
    STEPS.forEach((step) => {
      // Each binding stands alone: a missing select must not skip the tick.
      const select = byId(selectId(step));
      if (select && select.dataset.aiBound !== "true") {
        select.dataset.aiBound = "true";
        select.addEventListener("change", () => handleModelSelect(step));
      }
      const details = byId(advancedId(step));
      if (details && details.dataset.aiBound !== "true") {
        details.dataset.aiBound = "true";
        details.addEventListener("toggle", () => applyModelSelect(step));
      }
      const box = byId(stepId(step));
      if (box && box.dataset.aiChangeBound !== "true") {
        box.dataset.aiChangeBound = "true";
        box.addEventListener("change", () => {
          updateEstimate();
          updateSummary();
          updateRunButton();
        });
      }
    });

    watchPickerClose();
    if (!state.watchingProvider) {
      state.watchingProvider = true;
      window.addEventListener("provider:changed", () => {
        if (!state.running) refresh();
      });
    }

    const redescribe = byId(ELEMENT_IDS.redescribe);
    if (redescribe && redescribe.dataset.aiBound !== "true") {
      redescribe.dataset.aiBound = "true";
      redescribe.addEventListener("change", refresh);
    }

    const runButton = byId(ELEMENT_IDS.run);
    if (runButton && runButton.dataset.aiBound !== "true") {
      runButton.dataset.aiBound = "true";
      runButton.addEventListener("click", () => {
        run().catch((error) => logError("run threw", error));
      });
    }
    const rehearseButton = byId(ELEMENT_IDS.rehearse);
    if (rehearseButton && rehearseButton.dataset.aiBound !== "true") {
      rehearseButton.dataset.aiBound = "true";
      rehearseButton.addEventListener("click", () => {
        run({ rehearsal: true }).catch((error) => logError("rehearsal threw", error));
      });
    }
    const cancelButton = byId(ELEMENT_IDS.cancel);
    if (cancelButton && cancelButton.dataset.aiBound !== "true") {
      cancelButton.dataset.aiBound = "true";
      cancelButton.addEventListener("click", () => {
        cancelRun();
      });
    }
    const saveButton = byId(ELEMENT_IDS.saveLog);
    if (saveButton && saveButton.dataset.aiBound !== "true") {
      saveButton.dataset.aiBound = "true";
      saveButton.addEventListener("click", () => {
        try {
          saveRunLog();
        } catch (error) {
          logError("saveRunLog threw", error);
        }
      });
    }
    return refresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  logInfo("MathPixAITab ready");

  window.MathPixAITab = {
    STEPS,
    REASONS,
    BASIS,
    ELEMENT_IDS,
    init,
    refresh,
    modelLineFor,
    reasonFor,
    refreshModels,
    modelChoicesFor,
    servableModelsFor,
    handleModelSelect,
    run,
    // RP-3d: Cancel, its composer, and the words a stopped run uses.
    cancelRun,
    cancelLine,
    // RP-5: the rehearsal's stand-ins, words and clause, for rows and rigs.
    REHEARSAL_RUNNERS,
    REHEARSAL_CONFIRM_TEXT,
    REHEARSAL_ESTIMATE_TEXT,
    REHEARSAL_LINE_CLAUSE,
    REHEARSAL_STEP_MS,
    REHEARSAL_PICTURE_MS,
    isRehearsal: () => state.rehearsal,
    // RP-1: the composer, the ticker text and the run's status words, for rows and rigs.
    durationWords,
    tickerText,
    STATUS_WORDS,
    LINE_GAP_MS,
    tickerRunning: () => state.ticker !== null,
    endRowStatus,
    pictureRowStatus,
    pictureLabel,
    buildPictureRows,
    picturesCountText,
    QUEUE_IDS,
    estimateLine,
    confirmParts,
    tickedSteps,
    restoreSettled,
    MEASURED_COST_USD,
    devLogGate,
    saveRunLog,
    getRunLog: () => state.log,
    clearRunLog: () => {
      state.log = null;
      state.logSecrets = null;
      updateSaveLogButton();
    },
    RUN_LOG_SCHEMA,
    stepId,
    hintId,
    modelLineId,
    advancedId,
    selectId,
  };
})();
