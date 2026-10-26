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
 *       moves there once the confirm has closed. The Context line is not written
 *       when it ends if the pictures step follows (the manager would swallow it);
 *       it is composed with the pictures line and the Done line into one write
 *       after the manager closes.
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
  const NO_LINE_TEXT = "no message was returned.";
  const THREW_TEXT = "stopped unexpectedly.";

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
    announce: "resume-ai-announce",
    status: "resume-ai-status",
    outcomes: "resume-ai-outcomes",
    estimate: "resume-ai-estimate",
    redescribe: "resume-ai-redescribe",
    diff: "resume-ai-correction-diff",
    diffBody: "resume-ai-correction-diff-body",
    saveLog: "resume-ai-save-log",
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

  /** Said once, in the option text, of the registry's default model. */
  const RECOMMENDED_SUFFIX = ", recommended";

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
    return typeof selected === "string" && selected && selected !== recommendedId
      ? selected
      : null;
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

  /** "Display name (id, Provider)", or "id (Provider)" when no name is known. */
  function modelLabel(modelId, providerId, provider) {
    const name = displayNameFor(modelId, providerId);
    return name && name !== modelId
      ? `${name} (${modelId}, ${provider})`
      : `${modelId} (${provider})`;
  }

  /** The model line text for one step. */
  function modelLineFor(step) {
    const providerId = activeProviderId();
    const provider = providerLabel(providerId);
    const recommendedId = recommendedIdFor(step.purpose, providerId);
    const chosenId = chosenIdFor(step, recommendedId);

    if (chosenId) {
      return `Model for ${step.label}: ${modelLabel(chosenId, providerId, provider)}, ${BASIS.CHOSEN}`;
    }
    if (recommendedId) {
      return `Model for ${step.label}: ${modelLabel(recommendedId, providerId, provider)}, ${BASIS.RECOMMENDED}`;
    }
    return `Model for ${step.label}: none recommended for ${provider}`;
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

  function updateEstimate() {
    if (state.running) return;
    setText(byId(ELEMENT_IDS.estimate), estimateLine());
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

  /** S6-3d: empty the visible outcomes list and hide it, at the start of a run. */
  function clearOutcomes() {
    const list = byId(ELEMENT_IDS.outcomes);
    if (!list) return;
    list.replaceChildren();
    list.hidden = true;
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

  /** S6-3d: the same string the region speaks, as one plain list item. */
  function showOutcome(text) {
    const list = byId(ELEMENT_IDS.outcomes);
    if (!list) return;
    const item = document.createElement("li");
    item.textContent = text;
    list.appendChild(item);
    list.hidden = false;
  }

  /**
   * One line into the tab's own polite region (each line REPLACES the last),
   * and the same string appended to the visible list, which has no live role.
   */
  async function speak(text, listText = text) {
    await whenModalsClear();
    setText(byId(ELEMENT_IDS.announce), text);
    showOutcome(listText);
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

  /**
   * AT-6: resolve in the same task the last dialog stops being open (a
   * MutationObserver callback), so focus can be moved before anything else
   * runs; falls through after MODAL_CLEAR_MAX_MS.
   */
  function whenNoDialogOpen() {
    return new Promise((resolve) => {
      if (!document.querySelector("dialog[open]")) {
        resolve();
        return;
      }
      let timer = null;
      const observer = new MutationObserver(() => {
        if (document.querySelector("dialog[open]")) return;
        observer.disconnect();
        clearTimeout(timer);
        resolve();
      });
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["open"],
      });
      timer = setTimeout(() => {
        observer.disconnect();
        logWarn("whenNoDialogOpen: a dialog stayed open; moving focus anyway");
        resolve();
      }, MODAL_CLEAR_MAX_MS);
    });
  }

  /**
   * AT-6: the manager's close leaves focus on the mode radio. The moment the
   * dialog is gone, focus goes to the status paragraph; the composed line is
   * written later, after the settle in speak().
   */
  async function focusStatusAfterManagerClose() {
    await whenNoDialogOpen();
    const status = byId(ELEMENT_IDS.status);
    if (status && !status.hidden) status.focus();
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

  const RUNNERS = Object.freeze({
    correction: async () => {
      const enhancer = window.getMathPixAIEnhancer?.();
      if (!enhancer) return outcomeOf(false, null);
      const result = await enhancer.runCorrection({ apply: true });
      if (result && result.applied) showCorrectionDiff(enhancer);
      return outcomeOf(Boolean(result && result.applied), result && result.line);
    },
    context: async () => {
      const result = await window.MathPixContextAI?.handleAnalyseClick({
        quiet: true,
      });
      return outcomeOf(Boolean(result && result.filled), result && result.line);
    },
    pictures: async () => {
      const options = { quiet: true };
      const chosenId = chosenIdFor(STEPS[2], null);
      if (chosenId) options.model = chosenId;
      if (redescribeOn()) options.includeDescribed = true;
      let result;
      try {
        result = await window.describeAllImages(options);
      } finally {
        // The manager is a dialog; the body-child region is ignored while it
        // is open, so it closes through its own path before any line is written.
        window.closeImageManager?.();
      }
      return outcomeOf(
        Boolean(result && result.ran && result.generated > 0),
        result && result.line,
      );
    },
  });

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
      const outcome = await RUNNERS[step.key]();
      return finished({ ...outcome, detail: outcome.line });
    } catch (error) {
      logError(`runStep(${step.key}) threw`, error);
      const outcome = outcomeOf(false, THREW_TEXT);
      return finished({ ...outcome, detail: outcome.line });
    }
  }

  /** "Done: 3 of 3 steps ran." or "Done: 2 of 3; <step> was not applied: <line>". */
  function finalLine(results) {
    const ran = results.filter((entry) => entry.outcome.ok).length;
    const missed = results.filter((entry) => !entry.outcome.ok);
    if (missed.length === 0) return `Done: ${ran} of ${results.length} steps ran.`;
    const named = missed.map(
      (entry) =>
        `${entry.step.label} was ${entry.outcome.skipped ? "skipped" : "not applied"}: ${entry.outcome.detail.replace(/\.$/, "")}`,
    );
    return `Done: ${ran} of ${results.length}; ${named.join("; ")}.`;
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
   * awaited, one line per step; the last step's line and the final line in one
   * write. Resolves with the outcomes, or null when nothing ran.
   */
  async function run() {
    if (state.running) return null;
    const steps = tickedSteps();
    if (steps.length === 0 || !restoreSettled()) return null;

    state.running = true;
    let recorder = null;
    try {
      const names = steps.map((step) => step.label).join(", ");
      const confirmed = await window.safeConfirm(
        `${estimateLine(steps)} Steps, in order: ${names}. Run them now?`,
        RUN_TITLE,
        {
          confirmText: CONFIRM_RUN_TEXT,
          cancelText: CONFIRM_CANCEL_TEXT,
          returnFocusTo: byId(ELEMENT_IDS.run),
        },
      );
      if (!confirmed) {
        await focusRunAfterClose();
        return null;
      }

      setRunning(true);
      // AT-4: dev mode only. A new run replaces the last log; the button waits for this one to finish.
      state.log = null;
      state.logSecrets = null;
      recorder = devLogGate.enabled() ? createRunRecorder(steps) : null;
      updateSaveLogButton();
      clearOutcomes();
      clearCorrectionDiff();
      showStatus(RUNNING_TEXT);
      await focusStatusAfterClose();
      const results = [];
      // AT-1 (AI-D2a): the Context line is held while the pictures step will
      // open the manager (a modal swallows a body-child write), and is composed
      // with the pictures line and the Done line into one write after it closes.
      let heldContext = "";
      for (let i = 0; i < steps.length; i += 1) {
        const step = steps[i];
        const outcome = await runStep(step, recorder);
        results.push({ step, outcome });
        const line = `${step.label}: ${outcome.line}`;
        const isLast = i === steps.length - 1;
        if (step.key === "context" && steps[i + 1]?.key === "pictures") {
          heldContext = line;
          showOutcome(line);
          continue;
        }
        const lead = heldContext ? `${heldContext} ` : "";
        heldContext = "";
        if (step.key === "pictures" && !outcome.skipped) {
          // AT-6: the manager's close leaves focus on a radio. "Finished." goes
          // into the status paragraph first, focus follows once the dialog is
          // gone, and the composed line (speak settles again) comes last.
          if (isLast) showStatus(FINISHED_TEXT);
          await focusStatusAfterManagerClose();
        }
        if (isLast) {
          const done = finalLine(results);
          await speak(`${lead}${line} ${done}`, `${line} ${done}`);
        } else {
          await speak(`${lead}${line}`, line);
        }
      }
      showStatus(FINISHED_TEXT);
      return results;
    } finally {
      finishRunLog(recorder);
      state.running = false;
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
   * Every model the active provider serves that can do what the step needs,
   * { id, name }. Asking the capability facade per model costs about 200 ms for
   * a whole catalogue, so the answer is kept per provider and capability: the
   * two PDF steps share one list. Pass `fresh` to recompute.
   */
  function servableModelsFor(step, fresh) {
    const providerId = activeProviderId();
    const capability = step.key === "pictures" ? "image" : "pdf";
    const cacheKey = `${capability}|${providerId}`;
    if (!fresh && state.choiceCache.has(cacheKey)) return state.choiceCache.get(cacheKey);

    const selector = window.EmbedModelSelector;
    let all = [];
    if (selector && typeof selector.getEligibleModels === "function") {
      try {
        all = selector.getEligibleModels({ providerId, capabilities: [] });
      } catch (error) {
        logWarn("servableModelsFor: getEligibleModels threw", error);
      }
    }
    const servable = (Array.isArray(all) ? all : [])
      .filter((model) => model && typeof model.id === "string")
      .filter((model) => canServeStep(step, model.id))
      .map((model) => ({ id: model.id, name: model.name || model.id }));
    state.choiceCache.set(cacheKey, servable);
    return servable;
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
      select.replaceChildren(
        ...choices.map((choice) => {
          const option = document.createElement("option");
          option.value = choice.id;
          option.textContent =
            choice.id === recommendedId
              ? `${choice.name}${RECOMMENDED_SUFFIX}`
              : choice.name;
          return option;
        }),
      );
      select.dataset.aiOptions = signature;
    }

    const stored = storedModelFor(step);
    if (stored && select.value !== stored) select.value = stored;
  }

  /** Lines, selects and the estimate, from the stored values. No tick state, no focus. */
  function refreshModels() {
    STEPS.forEach((step) => {
      setText(byId(modelLineId(step)), modelLineFor(step));
      applyModelSelect(step);
    });
    updateEstimate();
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
    handleModelSelect,
    run,
    estimateLine,
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
