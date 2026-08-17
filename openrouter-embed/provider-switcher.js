/**
 * OpenRouter Embed - Provider Switcher (Stage 3a, Task 3.1a)
 *
 * Library-agnostic page-level state for the user's currently-active AI provider.
 *
 * Owns:
 * - localStorage persistence under key `selectedProvider` (default: 'openrouter')
 * - In-memory fallback when localStorage is unavailable
 * - Hardcoded known-providers list (extend here when new providers ship)
 * - Cross-tab synchronisation via the `storage` event
 * - Broadcast of `provider:changed` CustomEvent on every state transition
 * - Library-agnostic prefix filtering via filterToActiveProvider()
 *
 * Does NOT depend on:
 * - window.OpenRouterEmbed (legacy chat tool must work without it)
 * - window.EmbedProviderRegistry (set-up tool must work without it)
 * - window.EmbedProviderLookup (filter falls back to a local prefix list)
 *
 * Public API:
 *   ProviderSwitcher.getActive()              -> string
 *   ProviderSwitcher.setActive(id)            -> boolean (true on change)
 *   ProviderSwitcher.getKnown()               -> array of provider info objects
 *   ProviderSwitcher.isAvailable(id)          -> boolean
 *   ProviderSwitcher.filterToActiveProvider(models)  -> array
 *
 * Events:
 *   window dispatches 'provider:changed' with detail { oldProvider, newProvider }
 *   on every successful setActive call AND on cross-tab storage events.
 *
 * @version 1.0.0 (Stage 3a, Task 3.1a)
 * @date 17 May 2026
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

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[ProviderSwitcher ERROR] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[ProviderSwitcher WARN] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[ProviderSwitcher INFO] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[ProviderSwitcher DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // MODULE CONSTANTS
  // ============================================================================

  const STORAGE_KEY = "selectedProvider";
  const DEFAULT_PROVIDER_ID = "openrouter";
  const EVENT_NAME = "provider:changed";

  // Hardcoded known-providers list. Extend here when new providers ship.
  // Order matters for getKnown() output (UI lists providers in this order).
  // Each entry's id MUST match the corresponding provider id in
  // providers/<id>.js, AND the matching prefix in RESERVED_PROVIDER_PREFIXES.
  // azure-openai and azure-responses are two API surfaces of the SAME Microsoft
  // Foundry resource (shared `foundryProxyUrl` credential below). As of Task 5d
  // (option B) they are folded into ONE switcher entry, "Microsoft Foundry":
  // the `azure-openai` entry now surfaces BOTH surfaces' models via the umbrella
  // group in getEligibleModels (PROVIDER_GROUPS in the model selector). Transport
  // and routing stay split — each model still routes by its own prefix, and
  // `azure-responses` remains a reserved prefix + credential key below.
  const KNOWN_PROVIDERS = [
    { id: "openrouter", label: "OpenRouter" },
    { id: "azure-openai", label: "Microsoft Foundry" },
  ];

  // Local copy of the reserved-prefixes list. Mirrors the constant in
  // providers/_lookup.js. Duplicated here intentionally — this module must
  // work when the library (including EmbedProviderLookup) is absent.
  // Keep in sync manually when new prefixes are reserved.
  const RESERVED_PROVIDER_PREFIXES = [
    "openrouter",
    "azure-openai",
    "azure-responses",
    "azure-inference",
    "anthropic-foundry",
    "local",
  ];

  // localStorage credential keys, by provider id. Read-only — this module
  // never writes these. The Set Up tool owns writes.
  //
  // For the two Foundry ids the stored value is an OVERRIDE, not a
  // prerequisite: see PROVIDERS_WITH_WORKING_DEFAULT below. Absence of the key
  // does not mean the provider is unusable.
  const CREDENTIAL_KEYS = {
    openrouter: "openrouter_api_key",
    "azure-openai": "foundryProxyUrl",
    "azure-responses": "foundryProxyUrl",
  };

  // Provider ids whose adapter carries a working built-in default, so they
  // reach a live service with nothing stored in localStorage at all. These are
  // available unconditionally.
  //
  // Why this exists — it reads like a bug without the measurement behind it:
  //
  //   - Both Foundry adapters (providers/azure-openai-v1.js and
  //     providers/azure-openai-responses.js) fall back to a hardcoded
  //     production proxy URL when `foundryProxyUrl` is absent, so a person who
  //     has never opened the Foundry card still reaches the live Worker.
  //   - Measured after F2-18a armed production: with no stored key, 34 Foundry
  //     models were listed, were selectable, and a send returned 401 from the
  //     production Worker — proof the request arrived, not that it was blocked.
  //   - The Worker holds the Azure credential server-side, so there is nothing
  //     for a person to configure. The proxy URL field is an OVERRIDE for
  //     pointing at something else, not a prerequisite.
  //   - Reporting these two as unavailable told colleagues a working tool was
  //     unavailable. That is the defect this corrects.
  //
  // Deliberately NOT the URL itself, and deliberately not imported. This module
  // should know only THAT a default exists, never what it is — the providers own
  // the URL, and duplicating it here would create two things to keep in step.
  const PROVIDERS_WITH_WORKING_DEFAULT = Object.freeze([
    "azure-openai",
    "azure-responses",
  ]);

  // Tracks the currently-attached `storage` event listener so a second IIFE
  // execution (script tag duplicated, console paste during development) can
  // detach the previous handler before attaching its own. Without this, each
  // re-load adds another listener and cross-tab events get re-broadcast once
  // per surviving singleton.
  let _activeStorageListener = null;

  // ============================================================================
  // PROVIDER SWITCHER CLASS
  // ============================================================================

  class ProviderSwitcher {
    constructor() {
      // In-memory fallback when localStorage is unavailable. Initialised from
      // localStorage if accessible; otherwise stays at the default.
      this._memoryFallback = DEFAULT_PROVIDER_ID;
      this._localStorageBroken = false;
      this._lookupFallbackWarned = false;

      // Probe localStorage availability without throwing. Cache the result so
      // subsequent get/set calls don't repeat the try/catch overhead.
      this._tryReadInitial();

      // Cross-tab synchronisation. Filter to our key only; ignore the rest.
      this._attachStorageListener();

      logInfo("ProviderSwitcher initialised", {
        active: this.getActive(),
        localStorageBroken: this._localStorageBroken,
      });
    }

    // ==========================================================================
    // PRIVATE HELPERS
    // ==========================================================================

    /**
     * Probe localStorage at construction time. Caches `_localStorageBroken` so
     * the rest of the module can short-circuit without retrying. Also seeds
     * `_memoryFallback` from any persisted value, so a later localStorage
     * outage leaves the fallback coherent with what was visible at start.
     *
     * @private
     */
    _tryReadInitial() {
      try {
        const value = localStorage.getItem(STORAGE_KEY);
        if (typeof value === "string" && value) {
          this._memoryFallback = value;
        }
      } catch (err) {
        this._localStorageBroken = true;
        logWarn(
          "localStorage unavailable during initial probe; falling back to in-memory state",
          err
        );
      }
    }

    /**
     * Attach the cross-tab `storage` listener. Removes any prior listener
     * tracked in the module-scope `_activeStorageListener` reference first —
     * this guards against double-loads adding duplicate handlers.
     *
     * @private
     */
    _attachStorageListener() {
      if (_activeStorageListener) {
        window.removeEventListener("storage", _activeStorageListener);
        logInfo("Storage listener replaced (likely double-load)");
      }
      const bound = this._handleStorageEvent.bind(this);
      _activeStorageListener = bound;
      window.addEventListener("storage", bound);
    }

    /**
     * Handle a cross-tab `storage` event. Filters to our key, ignores no-op
     * events, and re-dispatches as `provider:changed` so subscribers receive
     * cross-tab transitions through the same channel as in-tab transitions.
     *
     * @private
     * @param {StorageEvent} event
     */
    _handleStorageEvent(event) {
      if (!event || event.key !== STORAGE_KEY) return;
      if (event.newValue === event.oldValue) return;

      const oldProvider = event.oldValue || DEFAULT_PROVIDER_ID;
      const newProvider = event.newValue || DEFAULT_PROVIDER_ID;

      logDebug(`Cross-tab storage event: ${oldProvider} → ${newProvider}`);

      // Keep the in-memory fallback coherent with what other tabs see.
      this._memoryFallback = newProvider;

      window.dispatchEvent(
        new CustomEvent(EVENT_NAME, {
          detail: { oldProvider, newProvider },
        })
      );
    }

    // ==========================================================================
    // PUBLIC API
    // ==========================================================================

    /**
     * Get the currently-active provider id.
     *
     * Reads localStorage if available; falls back to the in-memory value if
     * localStorage is broken (private browsing, disabled storage, quota
     * exceeded). When the stored value isn't a string, returns the default.
     * Returns the stored value AS-IS even if it isn't in getKnown() — callers
     * can use isAvailable() to detect that case.
     *
     * @returns {string} Provider id (default 'openrouter' if unset or unreadable)
     *
     * @example
     * const active = ProviderSwitcher.getActive();
     * // → 'openrouter' (default) or whatever was persisted
     */
    getActive() {
      if (this._localStorageBroken) return this._memoryFallback;

      try {
        const value = localStorage.getItem(STORAGE_KEY);
        if (value === null) return DEFAULT_PROVIDER_ID;
        if (typeof value !== "string") return DEFAULT_PROVIDER_ID;
        // Legacy migration (Task 5d): the folded "Microsoft Foundry" entry uses
        // id "azure-openai". Coerce a stored "azure-responses" to it and write
        // the corrected value back once. Guarded so a write failure never throws.
        if (value === "azure-responses") {
          try {
            localStorage.setItem(STORAGE_KEY, "azure-openai");
          } catch (writeErr) {
            logWarn(
              "Failed to migrate stored provider 'azure-responses' → 'azure-openai'",
              writeErr
            );
          }
          return "azure-openai";
        }
        return value;
      } catch (err) {
        this._localStorageBroken = true;
        logWarn(
          "localStorage read failed; switching to in-memory fallback",
          err
        );
        return this._memoryFallback;
      }
    }

    /**
     * Set the active provider. Persists to localStorage and broadcasts
     * `provider:changed`.
     *
     * Validates the id is in getKnown() before doing anything. Invalid id →
     * WARN log + no-op (does NOT throw — callers shouldn't crash on stale ids).
     *
     * When the new id equals the current id, no event fires (no-op for
     * idempotent calls). When localStorage is broken, persists to the
     * in-memory fallback only; the event still fires.
     *
     * @param {string} id - Provider id from getKnown()
     * @returns {boolean} true if state changed, false if no-op (same id or invalid)
     *
     * @example
     * if (ProviderSwitcher.setActive('azure-openai')) {
     *   // state actually changed; the event has been dispatched
     * }
     */
    setActive(id) {
      if (typeof id !== "string" || !id.trim()) {
        logWarn("setActive called with invalid id", { id });
        return false;
      }

      const known = KNOWN_PROVIDERS.some((p) => p.id === id);
      if (!known) {
        const knownList = KNOWN_PROVIDERS.map((p) => p.id).join(", ");
        logWarn(
          `setActive called with unknown id '${id}'. Known: ${knownList}`
        );
        return false;
      }

      const oldProvider = this.getActive();
      if (oldProvider === id) {
        logDebug(`setActive no-op (already ${id})`);
        return false;
      }

      if (!this._localStorageBroken) {
        try {
          localStorage.setItem(STORAGE_KEY, id);
        } catch (err) {
          this._localStorageBroken = true;
          logWarn(
            "localStorage write failed; continuing with in-memory update only",
            err
          );
        }
      }

      this._memoryFallback = id;

      window.dispatchEvent(
        new CustomEvent(EVENT_NAME, {
          detail: { oldProvider, newProvider: id },
        })
      );

      logInfo(`Provider changed: ${oldProvider} → ${id}`);
      return true;
    }

    /**
     * Get the list of known providers with their current status.
     *
     * Reads credential state from localStorage on every call (cheap; status
     * can change between calls if user edits credentials in another tab). A
     * provider with a working built-in default reports true without any read.
     *
     * Both fields come from isAvailable(), so both mean "usable now" rather
     * than "a credential is stored". Later stages may refine `available` to
     * additionally check EmbedProviderRegistry presence — the two-field shape
     * exists for that future divergence.
     *
     * @returns {Array<{id: string, label: string, configured: boolean, available: boolean}>}
     *
     * @example
     * ProviderSwitcher.getKnown()
     * // → [
     * //     { id: 'openrouter',   label: 'OpenRouter',         configured: true, available: true },
     * //     { id: 'azure-openai', label: 'Microsoft Foundry',  configured: true, available: true },
     * //   ]
     * // azure-openai is true even with nothing stored — its adapter has a
     * // working default proxy. openrouter still needs its API key.
     */
    getKnown() {
      return KNOWN_PROVIDERS.map(({ id, label }) => {
        const configured = this.isAvailable(id);
        return { id, label, configured, available: configured };
      });
    }

    /**
     * Check whether a provider is usable — i.e. it's a known provider that can
     * reach a live service right now, either because its adapter carries a
     * working built-in default or because its credentials are in localStorage.
     *
     * Returns false for unknown ids without warning (silent — this method is
     * called frequently from getKnown()'s map). Returns false when
     * localStorage is broken (we can't read credentials; treat as unavailable)
     * — except for the defaulted providers, which need no credential to work
     * and so are unaffected by storage being unreadable.
     *
     * @param {string} id - Provider id
     * @returns {boolean}
     *
     * @example
     * ProviderSwitcher.isAvailable('openrouter')    // → true if api key set
     * ProviderSwitcher.isAvailable('azure-openai')  // → always true (built-in default proxy)
     * ProviderSwitcher.isAvailable('nonsense')      // → false (silent)
     */
    isAvailable(id) {
      if (typeof id !== "string") return false;
      if (!KNOWN_PROVIDERS.some((p) => p.id === id)) return false;

      // A working built-in default means there is nothing to configure, so the
      // stored key is irrelevant here. Checked after the membership test above
      // so an unknown id still returns false.
      if (PROVIDERS_WITH_WORKING_DEFAULT.includes(id)) return true;

      const credentialKey = CREDENTIAL_KEYS[id];
      if (!credentialKey) return false;

      if (this._localStorageBroken) return false;

      try {
        const value = localStorage.getItem(credentialKey);
        return typeof value === "string" && value.length > 0;
      } catch (err) {
        this._localStorageBroken = true;
        logWarn(
          `localStorage read failed for credential key '${credentialKey}'; treating as unavailable`,
          err
        );
        return false;
      }
    }

    /**
     * Filter a list of models down to those served by the active provider.
     *
     * Uses EmbedProviderLookup.resolve() when available; falls back to a local
     * prefix-matching algorithm when the library isn't loaded. The fallback
     * warns once per session, not per call.
     *
     * Each model in the input must have an `id` field (string). Models with
     * non-string ids are filtered out (logged at DEBUG).
     *
     * @param {Array<{id: string, [key: string]: any}>} models
     * @returns {Array} Models whose resolved provider matches the active one
     *
     * @example
     * const all = window.modelRegistry.getAllModels();
     * const filtered = ProviderSwitcher.filterToActiveProvider(all);
     * // → only models whose id resolves to the active provider
     */
    filterToActiveProvider(models) {
      if (!Array.isArray(models)) return [];

      const activeId = this.getActive();
      const lookup = window.EmbedProviderLookup;
      const useLookup =
        lookup && typeof lookup.resolve === "function";

      if (!useLookup && !this._lookupFallbackWarned) {
        logWarn(
          "EmbedProviderLookup not loaded; using local prefix-match fallback in filterToActiveProvider. This is expected in legacy-tool contexts."
        );
        this._lookupFallbackWarned = true;
      }

      return models.filter((model) => {
        if (!model || typeof model.id !== "string") {
          logDebug("filterToActiveProvider: excluding entry with non-string id", model);
          return false;
        }

        if (useLookup) {
          let resolved = null;
          try {
            resolved = lookup.resolve(model.id);
          } catch (err) {
            logDebug(
              `filterToActiveProvider: EmbedProviderLookup.resolve threw for '${model.id}'`,
              err
            );
            return false;
          }
          return !!(resolved && resolved.id === activeId);
        }

        const slashIndex = model.id.indexOf("/");
        const prefix = slashIndex > 0 ? model.id.slice(0, slashIndex) : "";
        const resolvedId = RESERVED_PROVIDER_PREFIXES.includes(prefix)
          ? prefix
          : DEFAULT_PROVIDER_ID;
        return resolvedId === activeId;
      });
    }
  }

  // ============================================================================
  // SINGLETON INSTANCE
  // ============================================================================

  const providerSwitcher = new ProviderSwitcher();

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.ProviderSwitcher = providerSwitcher;
  window.ProviderSwitcherClass = ProviderSwitcher;

  // ============================================================================
  // INITIALIZATION LOG
  // ============================================================================

  logInfo("OpenRouter Embed Provider Switcher (Stage 3a Task 3.1a) loaded");
  logInfo("Available as: window.ProviderSwitcher (singleton instance)");
  logInfo("Class available as: window.ProviderSwitcherClass");
})();
