/**
 * Unified Chat Tool — Stage 2 step 2b-i (engine handle + populated picker)
 *
 * Stands up the Chat module and its own independent conversation state,
 * mirroring the shape of local-chat/local-chat.js. Step 2b-i adds the
 * Foundry-aware engine handle and fills the model picker with the grouped,
 * unified model list (locals + OpenRouter + Microsoft Foundry).
 *
 * Step 2b-iii drives the status line from the chosen model: on-device models
 * show their download/readiness state (with a "download in Set Up" link when
 * missing); cloud models clear the line silently.
 *
 * Deliberately NOT in this step: any send path, message rendering or thread
 * state (Chat still has no send button or message input).
 *
 * Loads AFTER local-chat/* because it depends on window.createChatState being
 * defined by local-chat/local-chat-state.js.
 *
 * @version 0.4.0 — Stage 2 step 2b-iii (model-driven download/readiness status)
 */
(function () {
  "use strict";

  // ── Logging configuration ───────────────────────────────────────────────
  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[Chat]");
      console.error.apply(console, args);
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[Chat]");
      console.warn.apply(console, args);
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[Chat]");
      console.log.apply(console, args);
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[Chat]");
      console.log.apply(console, args);
    }
  }

  // ── Own conversation state (independent from Local Chat) ─────────────────
  // Reuses the shared factory so Chat has its own messages[], own element-id
  // prefix and own storage keys. We must NOT touch window.LocalChatState here.
  if (typeof window.createChatState !== "function") {
    logError(
      "createChatState not available — local-chat/local-chat-state.js must load before chat/chat.js",
    );
    return;
  }

  window.ChatState = window.createChatState(
    "chat",
    "chat-session",
    "chat-history",
  );

  // S is a module-local reference to this tool's state. Internal code reads the
  // cached DOM map (S.els) live through S at call time, never caching it at
  // load, mirroring the Local Chat orchestrator's discipline.
  const S = window.ChatState;

  // Distinguishes an AUTO-selected opening model from a real USER pick. The
  // opening policy commits its auto-pick to S.currentModel via reflectSelection(),
  // so currentModel alone cannot tell the two apart. This flag is TRUE while the
  // current selection was chosen by the opening policy, and FALSE once the user
  // actively picks (or nothing is committed). The live re-resolve guard keys on
  // "has the USER chosen", i.e. (currentModel set AND openingAuto === false).
  S.openingAuto = false;

  // Module-local engine handle, built once (see buildEngineHandle). Used only
  // to gate the picker in this step — full message sending arrives later.
  let embed = null;
  // Guards so refresh() stays idempotent: the <select> change listener is wired
  // exactly once (the node persists across refreshes; only its <option>s rebuild).
  let changeWired = false;
  // The filter input + clear button listeners are also wired exactly once.
  let filterWired = false;
  // The live re-resolve listeners (provider:changed / credentials:changed) are
  // wired exactly once, so re-entrant init/refresh does not double-bind them.
  let eventsWired = false;

  // The full unified model list, cached ONCE at build time so filtering runs in
  // memory without re-gating (re-running getAllEligibleModels) on each keystroke.
  let allModels = [];

  // Pending timer for the debounced count announcement (see applyFilter).
  let announceTimer = null;

  // Calm-live-region guard for the status line. Holds the signature of the last
  // status we actually rendered (currentModel + "|" + state, with "cloud" used as
  // the state for cloud models). updateModelStatus() returns without re-rendering
  // when the new signature matches, so returning to the tool does not re-announce
  // an unchanged status — only a real model or state change speaks.
  let lastStatusSignature = null;

  // Hidden DOM node the embed attaches its ARIA live region to. The constructor
  // requires a real container; we never render into it at this stage.
  const HOST_ID = "chat-embed-host";

  // Foundry proxy fallback — mirrors the Image Describer's canonical wiring
  // exactly (image-describer-controller-generate.js). The proxy URL is sourced
  // from the shared `foundryProxyUrl` localStorage credential; this is the same
  // hardcoded fallback the app uses when that credential is absent.
  const FOUNDRY_PROXY_FALLBACK =
    "https://openrouter-embed-foundry-proxy.matthewdeeprose.workers.dev";

  // Fixed display order for the grouped picker. Groups with zero models are
  // skipped at build time. Foundry's two surfaces (azure-openai + azure-responses)
  // are unified by the selector under the single providerId "azure-openai".
  const GROUP_ORDER = [
    { providerId: "local", label: "On your device" },
    { providerId: "openrouter", label: "OpenRouter" },
    { providerId: "azure-openai", label: "Microsoft Foundry" },
  ];

  // ── Filter dials ────────────────────────────────────────────────────────
  // Each tweakable filter behaviour has exactly ONE home, named here so the
  // behaviour is easy to change after real screen-reader testing.

  // Selection behaviour: keep the user's chosen model even when a filter hides
  // it (true), versus letting the menu lead and following whatever the visible
  // list happens to select (false). v1 = preserve the choice.
  // CHANGE-HERE to alter selection behaviour.
  const PRESERVE_SELECTION_ON_FILTER = true;

  // The pause before the result count is announced AND the status line is
  // re-synced to the settled menu, so live-region chatter does not fire on every
  // keystroke. The list itself filters immediately; only the spoken announcement
  // waits for this pause (1 second, chosen after screen-reader testing).
  // CHANGE-HERE to alter the announce pause.
  const FILTER_ANNOUNCE_DEBOUNCE_MS = 1000;

  // Prefix spoken when the filter is explicitly cleared, so the action itself is
  // announced (e.g. "Filter cleared — 219 models match") rather than a bare count
  // that may read as no change.
  // CHANGE-HERE to alter the clear-announcement prefix.
  const FILTER_CLEARED_PREFIX = "Filter cleared — ";

  // ── Opening-model dials ───────────────────────────────────────────────────
  // The model the picker resolves to on a GENUINE first open (see the policy in
  // resolveOpeningModel). Each tweakable value has exactly ONE home here.

  // The opening cloud model per provider, used when that provider is selected
  // and usable. Foundry opens on gpt-5.2; OpenRouter on Claude Haiku 4.5.
  // CHANGE-HERE: opening cloud model per provider.
  const DEFAULT_CLOUD_MODEL = {
    openrouter: "anthropic/claude-haiku-4.5",
    "azure-openai": "azure-openai/gpt-5.2",
  };

  // Leading text of the status-line notice shown when nothing is usable (no
  // usable cloud provider and no downloaded local model). An "open Set Up" link
  // and a trailing clause follow it (see showConfigureNotice).
  // CHANGE-HERE: shown when nothing is usable (link follows: "open Set Up").
  const CONFIGURE_NOTICE_TEXT = "No provider set up yet — ";

  // Map a providerId to its display GROUP LABEL via the single GROUP_ORDER map.
  // Returns "" when unknown, so callers can safely lower-case/.indexOf on it.
  function groupLabelForProviderId(providerId) {
    const group = GROUP_ORDER.find((g) => g.providerId === providerId);
    return group ? group.label : "";
  }

  // Single home for "what counts as a match". Case-insensitive; an empty term
  // matches everything. Matches on the model NAME or on the model's provider
  // GROUP LABEL (never the raw providerId).
  function modelMatchesFilter(model, term) {
    const needle = (term || "").trim().toLowerCase();
    if (needle === "") return true;
    const name = (model.name || "").toLowerCase();
    const groupLabel = groupLabelForProviderId(model.providerId).toLowerCase();
    return name.indexOf(needle) !== -1 || groupLabel.indexOf(needle) !== -1;
  }

  // Single home for the spoken count phrasing.
  function filterCountMessage(n) {
    if (n === 0) return "No models match";
    if (n === 1) return "1 model matches";
    return n + " models match";
  }

  // ── Element caching ─────────────────────────────────────────────────────
  // Only the model-bar shell elements exist for now. More are added as later
  // steps grow the panel.
  function cacheElements() {
    const els = S.els;
    els.select = document.getElementById(S.elId("model-select"));
    els.status = document.getElementById(S.elId("model-status"));
    els.search = document.getElementById(S.elId("model-search"));
    els.count = document.getElementById(S.elId("model-count"));
    els.filterClear = document.getElementById(S.elId("model-filter-clear"));
  }

  // ── Engine handle ─────────────────────────────────────────────────────────

  /**
   * Ensure the hidden host element the embed attaches to exists. Created once
   * and reused; appended inside #chat-app when present, else to <body>.
   */
  function ensureEmbedHost() {
    let host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement("div");
      host.id = HOST_ID;
      host.hidden = true; // display:none — the embed only needs a DOM node here
      const parent = document.getElementById("chat-app") || document.body;
      parent.appendChild(host);
    }
    return host;
  }

  /**
   * Build the Foundry-aware engine handle ONCE. Idempotent — returns the cached
   * instance on subsequent calls. The handle is built only to gate the picker
   * (via the selector's `embed` argument); it is never used to send in 2b-i.
   * Mirrors the Image Describer's canonical Foundry configuration: BOTH surfaces
   * configured from the shared `foundryProxyUrl` credential.
   * @returns {Object|null} the OpenRouterEmbed instance, or null if unavailable
   */
  function buildEngineHandle() {
    if (embed) return embed; // built once

    if (typeof window.OpenRouterEmbed !== "function") {
      logWarn(
        "OpenRouterEmbed not available — engine handle not built; picker will be ungated",
      );
      return null;
    }

    const proxyUrl =
      localStorage.getItem("foundryProxyUrl") || FOUNDRY_PROXY_FALLBACK;

    try {
      ensureEmbedHost();
      embed = new window.OpenRouterEmbed({
        containerId: HOST_ID,
        // A model id is irrelevant to gating — this handle never sends in 2b-i.
        // A cheap OpenRouter id keeps construction valid.
        model: "anthropic/claude-haiku-4.5",
        showNotifications: false,
        // Honours a reduced-motion preference by delivering the whole reply at
        // once rather than streaming token-by-token (the accessibility decision
        // recorded in the plan).
        respectReducedMotion: true,
        // The embed's built-in streaming progress indicator carries its own role="status"/aria-live, which a screen reader voices over the reply; Chat suppresses it and uses its own "Generating response." / "Response ready." cues instead.
        showStreamingProgress: false,
        // Canonical Foundry wiring: configure both surfaces from the shared
        // credential. The library ignores these for OpenRouter-routed models.
        providers: {
          "azure-openai": { proxyUrl: proxyUrl },
          "azure-responses": { proxyUrl: proxyUrl },
        },
      });
      S.embed = embed;
      Chat._embed = embed;
      logInfo(
        "engine handle built — providers configured:",
        "openrouter=available(localStorage key)",
        "azure-openai=" + embed.isProviderConfigured("azure-openai"),
        "azure-responses=" + embed.isProviderConfigured("azure-responses"),
      );
    } catch (err) {
      logError("failed to build engine handle:", err);
      embed = null;
    }
    return embed;
  }

  // ── Model picker ───────────────────────────────────────────────────────────

  /**
   * Navigate to the Set Up tool and focus the Set Up card for a given on-device
   * model. Mirrors Local Chat's navigateToSetupModel, but takes the SHORT model
   * key (e.g. "qwen2.5-1.5b") — the value Set Up card ids are keyed on — rather
   * than the full "local/…" id Chat stores in ChatState.
   * @param {string} shortKey the registry key (no "local/" prefix)
   */
  function navigateToSetupModel(shortKey) {
    const radio = document.getElementById("SetUp");
    if (radio) radio.checked = true;
    if (typeof showSetUp === "function") showSetUp(false);
    setTimeout(function () {
      if (!shortKey) return;
      const card = document.getElementById("setup-tm-model-" + shortKey);
      if (card) {
        card.scrollIntoView({ behavior: "instant", block: "start" });
        card.setAttribute("tabindex", "-1");
        card.focus({ preventScroll: true });
      }
    }, 500);
  }

  /**
   * Single home for the "local/" prefix strip. Returns the SHORT model key when
   * `id` is an on-device model id, else null (i.e. a cloud model).
   * @param {string} id a full model id
   * @returns {string|null} the short key, or null for cloud
   */
  function localKeyFromId(id) {
    const PREFIX = "local/";
    return typeof id === "string" && id.indexOf(PREFIX) === 0
      ? id.slice(PREFIX.length)
      : null;
  }

  /**
   * Reflect the current selection into ChatState. Stores the FULL model id
   * (e.g. "local/…") — never a re-prefixed or bare key — then drives the status
   * line from that model via updateModelStatus().
   */
  function reflectSelection() {
    const els = S.els;
    const select = els.select;
    if (!select) return;
    const opt = select.options[select.selectedIndex] || null;
    S.currentModel = (opt && opt.value) || null;
    updateModelStatus();
  }

  /**
   * Drive the status line from the model the MENU IS CURRENTLY SHOWING (its
   * selected option's value), NOT the committed ChatState.currentModel — so the
   * status follows the menu as filtering changes what is on display. On-device
   * models show their download/readiness state (and, when not yet downloaded, a
   * link into Set Up); cloud models clear the line silently — there is nothing to
   * say about a hosted model's local availability. A calm-live-region guard
   * suppresses re-renders when neither the shown model nor its state has changed,
   * so returning to the tool does not re-announce an unchanged status.
   *
   * This reads, but never writes, the selection: the committed
   * ChatState.currentModel is still set only by reflectSelection() on a real pick.
   */
  function updateModelStatus() {
    const els = S.els;
    if (!els.status) return;

    const shownModel = (els.select && els.select.value) || null;
    if (!shownModel) {
      els.status.textContent = "";
      lastStatusSignature = null;
      return;
    }

    const shortKey = localKeyFromId(shownModel);

    // Cloud model — silent. Clear the line, but only re-render (and reset the
    // signature) when something actually changed.
    if (shortKey === null) {
      const signature = shownModel + "|cloud";
      if (signature === lastStatusSignature) return;
      els.status.textContent = "";
      lastStatusSignature = signature;
      return;
    }

    // On-device model — derive its state, guarding the manager.
    let state = "unknown";
    if (
      window.LocalTextModelManager &&
      typeof window.LocalTextModelManager.getModelState === "function"
    ) {
      state = window.LocalTextModelManager.getModelState(shortKey);
    }

    const signature = shownModel + "|" + state;
    if (signature === lastStatusSignature) return;

    const label = S.STATUS_LABELS[state] || S.STATUS_LABELS.unknown;

    if (state === "not-downloaded") {
      els.status.innerHTML = "Not downloaded — ";
      const setupLink = document.createElement("a");
      setupLink.href = "#setup-tm-model-" + shortKey;
      setupLink.textContent = "download in Set Up";
      setupLink.addEventListener("click", function (e) {
        e.preventDefault();
        navigateToSetupModel(shortKey);
      });
      els.status.appendChild(setupLink);
    } else {
      els.status.textContent = label;
    }

    lastStatusSignature = signature;
    logDebug("model status:", shownModel, "→", state, "(" + label + ")");
  }

  // ── Opening-model policy ──────────────────────────────────────────────────
  // On a GENUINE first open (no chosen model yet), the picker resolves which
  // model to start on from the current provider/credential/local-model state.
  // The three helpers below are lifted verbatim from the decision recipes in
  // provider-credential-model-state-kb.md §7; every global they touch is
  // optional (defensive) so a missing dependency degrades gracefully.

  // The active cloud provider id, defaulting to OpenRouter. (KB §7.1)
  function activeProvider() {
    return window.ProviderSwitcher?.getActive?.() || "openrouter";
  }

  // Whether a provider can be used right now. Foundry is always usable via its
  // built-in proxy; OpenRouter needs a user key. NOT ProviderSwitcher
  // .isAvailable() — that tracks the custom proxy only (KB §2.3 / §7.1).
  function isProviderUsable(id) {
    if (id === "azure-openai") return true;
    if (id === "openrouter") return !!localStorage.getItem("openrouter_api_key");
    return false;
  }

  // The first on-device text model that is downloaded-and-ready. "Ready" means
  // cached OR loaded — a strict "loaded" test almost never fires at a fresh open
  // (KB §4.2 / §7.2). Returns null when none is ready.
  function firstReadyTextModel() {
    return (
      window.LocalTextModelManager?.getRegisteredModels?.().find(
        (m) => m.state === "cached" || m.state === "loaded",
      ) || null
    );
  }

  /**
   * Resolve the model the picker should open on, top-to-bottom, first match
   * wins (run once, on a genuine first load):
   *   1. selected provider usable → its named cloud default; defensively, if
   *      that named id is absent from the list, the active provider's first
   *      model; else fall through;
   *   2. a downloaded-and-ready local text model present in the list → its id;
   *   3. otherwise → { kind: "none" } (caller shows the configure notice).
   * Reads the module-local `allModels`, so it must be called after the list is
   * built in populateModelPicker.
   * @returns {{kind:string, id?:string}}
   */
  function resolveOpeningModel() {
    const provider = activeProvider();

    if (isProviderUsable(provider)) {
      const wanted = DEFAULT_CLOUD_MODEL[provider];
      if (wanted && allModels.some((m) => m.id === wanted)) {
        return { kind: "cloud", id: wanted };
      }
      // Defensive: the named default is missing from the list — open on the
      // first model belonging to the active provider, if any.
      const firstForProvider = allModels.find((m) => m.providerId === provider);
      if (firstForProvider) {
        return { kind: "cloud", id: firstForProvider.id };
      }
      // else fall through to local / none.
    }

    const local = firstReadyTextModel();
    if (local) {
      const localId = "local/" + local.key;
      if (allModels.some((m) => m.id === localId)) {
        return { kind: "local", id: localId };
      }
    }

    return { kind: "none" };
  }

  /**
   * Show the "no provider set up" notice in the status line, with an inline link
   * into Set Up. Shares the calm-live-region guard: a "configure" signature is
   * stored so returning to the tool while still unconfigured does not re-render
   * or re-announce. Never writes ChatState.currentModel — so once the user adds
   * a key or downloads a model, the next open re-resolves cleanly.
   */
  function showConfigureNotice() {
    const els = S.els;
    if (!els.status) return;
    if (lastStatusSignature === "configure") return;

    els.status.textContent = "";
    els.status.appendChild(document.createTextNode(CONFIGURE_NOTICE_TEXT));

    const setupLink = document.createElement("a");
    setupLink.href = "#SetUp";
    setupLink.textContent = "open Set Up";
    setupLink.addEventListener("click", function (e) {
      e.preventDefault();
      if (typeof window.showSetUp === "function") window.showSetUp();
    });
    els.status.appendChild(setupLink);

    els.status.appendChild(
      document.createTextNode(" to add a key or download a model."),
    );

    lastStatusSignature = "configure";
    logDebug("configure notice shown — nothing usable");
  }

  /**
   * Render the <select> from a GIVEN list of models. Clears first so it is safe
   * to call repeatedly (no duplicate optgroups). Groups are built in GROUP_ORDER;
   * any group with zero models in the given list is skipped. This is the single
   * place the optgroup markup is built — both the initial populate and the live
   * filter render through here.
   * @param {Array<Object>} list models to show (already filtered, or the full set)
   */
  function renderPickerOptions(list) {
    const select = S.els.select;
    if (!select) {
      logWarn("model select not found — cannot render picker");
      return;
    }

    select.innerHTML = "";

    const counts = {};
    GROUP_ORDER.forEach((group) => {
      const models = list.filter((m) => m.providerId === group.providerId);
      if (models.length === 0) return; // skip empty groups

      const optgroup = document.createElement("optgroup");
      optgroup.label = group.label;
      models.forEach((model) => {
        const option = document.createElement("option");
        option.value = model.id; // FULL id verbatim (e.g. "local/…")
        option.textContent = model.name;
        optgroup.appendChild(option);
      });
      select.appendChild(optgroup);
      counts[group.label] = models.length;
    });

    logDebug("picker rendered — per group:", counts, "total=" + list.length);
  }

  /**
   * Apply the opening-model policy to the picker: resolve the opening model from
   * the CURRENT provider/credential/local-model state and reflect it into the
   * menu, exactly as the genuine first-load path does. This is the single home of
   * that body, shared by populateModelPicker()'s first-load branch and the live
   * re-resolve handler (maybeReResolveOpening), so both behave identically.
   *
   * Writes ChatState.currentModel ONLY via reflectSelection(); the none case
   * writes nothing (it shows the configure notice and leaves the menu usable).
   * @param {Array<Object>} rendered the models currently shown in the menu
   */
  function applyOpeningModel(rendered) {
    const select = S.els.select;
    if (!select) return;

    const opening = resolveOpeningModel();
    if (opening.kind === "none") {
      // Nothing usable: clear any prior commit so the tool is genuinely in the
      // "nothing chosen" state (a live revert of an earlier AUTO default lands
      // here), mark it non-auto, and show the configure notice. The menu stays on
      // its first option (still usable). On a genuine first load currentModel is
      // already null, so this clear is a no-op there.
      S.currentModel = null;
      S.openingAuto = false;
      showConfigureNotice();
    } else if (rendered.some((m) => m.id === opening.id)) {
      // The opening model is visible — select it and reflect it. reflectSelection()
      // writes currentModel and runs updateModelStatus, so a cloud default clears
      // the line silently and a local default shows its download/readiness state.
      // This is an AUTO pick (the policy chose it, not the user), so mark it so a
      // later credential/provider change may revert it.
      select.value = opening.id;
      reflectSelection();
      S.openingAuto = true;
    } else {
      // Safety net: the opening model is not in the rendered list (e.g. a filter
      // currently hides it) — adopt the first option. Still an AUTO pick.
      reflectSelection();
      S.openingAuto = true;
    }
  }

  /**
   * Populate the picker from the unified model list. Caches that list ONCE into
   * the module-local `allModels` so subsequent filtering runs in memory without
   * re-gating. Idempotent with respect to USER state — a rebuild (e.g. the
   * tool-switcher's deferred refresh) preserves both the chosen model and any
   * active filter:
   *  - the active filter term is read LIVE from the search input (its single
   *    source of truth), so a refresh re-renders the filtered subset, not the
   *    full list;
   *  - the user's chosen model is restored into the menu when still visible, and
   *    is NEVER reset to the first option. Only a genuine first load (no chosen
   *    model yet) adopts the first option as the selection. A chosen model that
   *    is currently filtered out is left untouched and returns when the filter
   *    clears (the keep-the-choice behaviour).
   */
  function populateModelPicker() {
    const select = S.els.select;
    if (!select) {
      logWarn("model select not found — cannot populate picker");
      return;
    }

    const selector = window.EmbedModelSelector;
    if (!selector || typeof selector.getAllEligibleModels !== "function") {
      logWarn(
        "EmbedModelSelector.getAllEligibleModels unavailable — picker left empty",
      );
      return;
    }

    // No capability filter in v1 — the unified list as-is. Cached once here.
    allModels = selector.getAllEligibleModels({ embed: embed });

    // Capture the user's chosen model BEFORE the rebuild, so restoring the menu
    // never depends on the new option order.
    const previousModel = S.currentModel;

    // Respect any active filter — the search input value is the single source of
    // truth for the current term. Non-empty → filtered subset; empty → full.
    const term = (S.els.search && S.els.search.value) || "";
    const rendered =
      term.trim() === ""
        ? allModels
        : allModels.filter((m) => modelMatchesFilter(m, term));

    renderPickerOptions(rendered);

    if (previousModel) {
      // Keep the user's choice. Restore the menu to it when still visible;
      // restoring is programmatic (select.value) and does NOT fire 'change', so
      // ChatState.currentModel is left exactly as it was. When the choice is
      // filtered out it stays unchanged and simply isn't shown.
      if (rendered.some((m) => m.id === previousModel)) {
        select.value = previousModel;
      }
      // Refresh the status from the restored model's CURRENT state. The restore
      // above is programmatic (no 'change' fires, so no currentModel write), but
      // an on-device model's download state may have moved on since the last
      // render. The calm-live-region guard keeps this silent when unchanged.
      updateModelStatus();
    } else {
      // Genuine first load — resolve the opening model from the current
      // provider/credential/local-model state (the opening-model policy), NOT
      // simply the first option. This is the ONLY populate path that writes
      // ChatState.currentModel. The resolution body is shared with the live
      // re-resolve handler via applyOpeningModel().
      applyOpeningModel(rendered);
    }

    logDebug(
      "picker populated — term='" +
        term.trim() +
        "' rendered=" +
        rendered.length +
        " total=" +
        allModels.length,
    );
  }

  /**
   * Wire the <select> change handler exactly once. On change, store the FULL id
   * in ChatState and mirror the chosen option's name into the status region.
   */
  function wireChange() {
    if (changeWired) return;
    const select = S.els.select;
    if (!select) return;
    select.addEventListener("change", function () {
      reflectSelection();
      // A genuine user pick clears the auto mark — this selection is now the
      // user's choice and must never be reverted by a credential/provider change.
      // Only this listener fires on real interaction; programmatic select.value
      // restores (filter/refresh) do NOT run here, so they never clear the mark.
      S.openingAuto = false;
      // Announce the switch ONCE per change, tailored to whether a thread is
      // live. The selected option's textContent is the display NAME the user
      // sees in the picker (the same name the per-turn badge shows), so we read
      // it straight off the option rather than announcing the raw model id.
      const opt = select.options[select.selectedIndex] || null;
      const name =
        (opt && opt.textContent) || S.currentModel || "the selected model";
      if (S.messages && S.messages.length > 0) {
        S.announceToScreenReader(
          "Switched to " + name + ". Your conversation continues.",
        );
      } else {
        S.announceToScreenReader("Switched to " + name + ".");
      }
      logDebug("model selection changed to:", S.currentModel);
    });
    changeWired = true;
  }

  // ── Filtering ───────────────────────────────────────────────────────────

  /**
   * Apply the filter term. The LIST is re-rendered immediately so typing feels
   * responsive; only the spoken COUNT is debounced (FILTER_ANNOUNCE_DEBOUNCE_MS)
   * to avoid live-region chatter on every keystroke. Selection persistence is
   * governed solely by PRESERVE_SELECTION_ON_FILTER: when on, a still-visible
   * chosen model is re-selected in the menu; when the choice is filtered out,
   * ChatState.currentModel is left UNCHANGED (the hidden option simply isn't in
   * the menu). This repopulation is programmatic and must NOT fire a user-style
   * change — it never writes ChatState.currentModel.
   * @param {string} rawTerm the raw input value
   */
  function applyFilter(rawTerm) {
    const select = S.els.select;
    if (!select) return;

    const term = (rawTerm || "").trim();
    const filtered = allModels.filter((m) => modelMatchesFilter(m, term));

    // Responsive: render the narrowed list at once.
    renderPickerOptions(filtered);

    // Selection persistence — single dial.
    if (PRESERVE_SELECTION_ON_FILTER && S.currentModel) {
      const stillVisible = filtered.some((m) => m.id === S.currentModel);
      if (stillVisible) {
        select.value = S.currentModel; // re-select; does not fire 'change'
      }
      // If hidden: leave ChatState.currentModel untouched — do NOT overwrite a
      // user's choice just because its option is currently filtered away.
    }

    // Debounce the spoken updates — the COUNT and the STATUS line — onto a single
    // settle after the pause, so neither fires on every keystroke. The list itself
    // already re-rendered above; only the announcement waits. After the pause the
    // count speaks once AND the status reflects the model the settled menu shows.
    if (announceTimer) clearTimeout(announceTimer);
    const count = S.els.count;
    const n = filtered.length;
    announceTimer = setTimeout(function () {
      if (count) count.textContent = filterCountMessage(n);
      updateModelStatus(); // status follows the settled filtered menu
    }, FILTER_ANNOUNCE_DEBOUNCE_MS);

    logDebug("filter applied — term='" + term + "' matches=" + filtered.length);
  }

  /**
   * Clear the filter: empty the input, render the full list, restore the chosen
   * selection if it is still present, and refresh the count immediately.
   */
  function clearFilter() {
    const select = S.els.select;
    if (S.els.search) S.els.search.value = "";

    renderPickerOptions(allModels);

    if (PRESERVE_SELECTION_ON_FILTER && select && S.currentModel) {
      const stillVisible = allModels.some((m) => m.id === S.currentModel);
      if (stillVisible) select.value = S.currentModel;
    }

    if (announceTimer) {
      clearTimeout(announceTimer);
      announceTimer = null;
    }
    if (S.els.count) {
      // Announce the clear action itself, then the restored count.
      S.els.count.textContent =
        FILTER_CLEARED_PREFIX + filterCountMessage(allModels.length);
    }

    // Reflect the restored menu's status. A committed selection drives the status
    // line; with none committed (the first-load none state), restore the configure
    // notice rather than leaving a stale filtered status behind.
    if (S.currentModel) {
      updateModelStatus();
    } else {
      showConfigureNotice();
    }

    logDebug("filter cleared — full list restored (" + allModels.length + ")");
  }

  /**
   * Wire the filter input + clear button exactly once. The search input drives
   * applyFilter on every keystroke; the clear button resets. Neither path writes
   * ChatState.currentModel — only the <select> change listener (wireChange) does.
   */
  function wireFilter() {
    if (filterWired) return;
    const search = S.els.search;
    const clearBtn = S.els.filterClear;
    if (!search && !clearBtn) return;

    if (search) {
      search.addEventListener("input", function () {
        applyFilter(search.value);
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        clearFilter();
      });
    }
    filterWired = true;
  }

  // ── Live re-resolve on credential / provider change ───────────────────────

  // TODO (deferred, Stage 3 parked item): a provider/credential change mid-thread
  // can leave a live conversation pinned to a model that is no longer usable
  // (e.g. the OpenRouter key is cleared while the thread is on an OpenRouter
  // model). Change 2 below stops the model from silently switching out from under
  // a live thread, but it does NOT yet handle the "current model became unusable
  // mid-thread" case — surfacing that to the user and offering a safe switch is
  // deferred as its own piece of work. No handling for it is implemented here.

  /**
   * Re-resolve the opening model when credentials or the active provider change
   * while Chat is open — but ONLY while the user has not actively chosen. Nothing
   * committed, or a model the opening policy AUTO-picked (openingAuto), both count
   * as "not the user's choice", so a live change can revert an AUTO default; a
   * genuine user pick is never overridden.
   *
   * Re-runs the opening-model policy against the current list (respecting any
   * active filter, exactly as the first-load path does) via applyOpeningModel().
   * The eligible list itself does not depend on the OpenRouter key or the active
   * provider (all providers' models are always listed); only the policy's
   * usability test does, so re-running it against the existing `allModels` is
   * sufficient — no repopulate needed.
   */
  function maybeReResolveOpening() {
    // Bail only on a genuine USER pick — a committed selection that was NOT chosen
    // by the opening policy. Proceed while nothing is committed OR the current
    // selection was auto-picked (openingAuto), so a live credential/provider
    // change can revert an AUTO default but never the user's real choice.
    if (S.currentModel && !S.openingAuto) return;
    // Once the user has sent a message, the thread commits to the current model:
    // a non-empty conversation is itself a commitment, even if the user reached
    // that model via the tool's auto-pick and never touched the dropdown. An
    // auto-revert driven by a credentials/provider change must NOT silently
    // switch the model out from under a live conversation (the silent-switch bug).
    if (S.messages && S.messages.length > 0) return;

    const select = S.els.select;
    if (!select) return;

    // Respect any active filter — the rendered subset is what the menu shows,
    // matching populateModelPicker()'s first-load contract.
    const term = (S.els.search && S.els.search.value) || "";
    const rendered =
      term.trim() === ""
        ? allModels
        : allModels.filter((m) => modelMatchesFilter(m, term));

    applyOpeningModel(rendered);
    logDebug("live re-resolve — no user pick in force, opening model re-applied");
  }

  /**
   * Wire the live re-resolve triggers exactly once. Both fire on `window`:
   * provider changes dispatch "provider:changed" (provider-credential KB §2.4),
   * and credential saves/clears dispatch "credentials:changed" on window too
   * (setup-tool.js's emitCredentialChange bridges EmbedEventEmitter onto window —
   * the canonical consumer channel). maybeReResolveOpening self-guards on the
   * user-pick state, so a model the user actively chose is never overridden.
   */
  function wireProviderEvents() {
    if (eventsWired) return;
    window.addEventListener("provider:changed", maybeReResolveOpening);
    window.addEventListener("credentials:changed", maybeReResolveOpening);
    eventsWired = true;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  /**
   * Initialise the Chat tool. Idempotent — safe to call repeatedly. Caches the
   * shell elements, builds the engine handle once, wires the change listener
   * once, then populates the picker.
   */
  function init() {
    cacheElements();
    buildEngineHandle();
    wireChange();
    wireFilter();
    wireProviderEvents();
    populateModelPicker();
    logInfo("init complete (engine handle + grouped picker populated)");
  }

  /**
   * Refresh the Chat tool. Called by the tool-switcher's TOOL_CONFIG init on
   * every switch to the Chat tool. Idempotent — re-caches elements, reuses the
   * existing engine handle, and rebuilds the option list (clearing first).
   */
  function refresh() {
    cacheElements();
    buildEngineHandle();
    wireChange();
    wireFilter();
    wireProviderEvents();
    populateModelPicker();
    logDebug("refresh complete (picker re-populated)");
  }

  // ── Expose singleton ────────────────────────────────────────────────────
  const Chat = {
    init: init,
    refresh: refresh,
    _embed: null, // set once buildEngineHandle succeeds
    // Read-only view of the filter dials, so the active behaviour is inspectable
    // from the console without exposing internals.
    _filterConfig: {
      preserveSelectionOnFilter: PRESERVE_SELECTION_ON_FILTER,
      announceDebounceMs: FILTER_ANNOUNCE_DEBOUNCE_MS,
    },
    // Read-only reference to the picker's group order/labels, so other modules
    // (e.g. chat-messages.js's provider badge) have one source of truth rather
    // than their own copy of the provider labels.
    groupOrder: GROUP_ORDER,
  };

  window.Chat = Chat;
})();
