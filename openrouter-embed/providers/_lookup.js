/**
 * OpenRouter Embed API - Provider Lookup (Stage 1, Task 1.3)
 *
 * Resolves a model identifier to a registered Provider, applying the project's
 * namespace convention from architecture decision A2. Lives separately from
 * `_interface.js` so that adding a new provider stage (Foundry, Azure-Inference,
 * Anthropic-Foundry, etc.) means editing one file rather than core.js.
 *
 * Lookup rule:
 *   1. If the model identifier's prefix (text before the first '/') is in
 *      RESERVED_PROVIDER_PREFIXES, return registry.get(prefix) — which may
 *      be null if that provider isn't loaded yet. This prevents legacy
 *      fallback for explicit-but-unconfigured Foundry namespaces such as
 *      'azure-openai/...' before Stage 2 ships.
 *   2. Otherwise (legacy OpenRouter form like 'anthropic/claude-3.5-haiku',
 *      bare model name, or any unrecognised prefix), fall back to the
 *      OpenRouter provider — preserving existing behaviour for every model
 *      string that exists today.
 *
 * Note: models with the 'local/' prefix bypass the registry entirely and are
 * handled by EmbedLocalBackend. This module's `resolve()` does not reflect
 * that routing — it returns the OpenRouter default for 'local/...' because
 * that's the honest result of applying the lookup rule. core.js's local/
 * guard pre-empts dispatch before resolve() is reached, so the asymmetry is
 * documented but never observable in practice.
 *
 * Features:
 * - Pure-function `resolve(modelId)` — no caching, no instance state
 * - Reserved-prefix introspection (`isReserved`, `getReservedPrefixes`)
 * - Lazy registry access — load-order errors surface at first use, not at
 *   module-load time
 * - Singleton instance plus class globally exposed
 *
 * @version 1.0.0 (Stage 1, Task 1.3)
 * @date 8 May 2026
 */

(function () {
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
      console.error(`[EmbedProviderLookup ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedProviderLookup WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedProviderLookup INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedProviderLookup DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // RESERVED PREFIXES & DEFAULT PROVIDER
  // ============================================================================

  // Prefixes whose lookup is strict — registry.get(prefix) is returned even
  // if that returns null. Adding a new provider stage adds its prefix here.
  const RESERVED_PROVIDER_PREFIXES = new Set([
    "openrouter",
    "azure-openai",
    "azure-inference",   // Stage 5 (deferred)
    "anthropic-foundry", // Stage 4 (deferred)
  ]);

  const DEFAULT_PROVIDER_ID = "openrouter";

  // ============================================================================
  // EMBED PROVIDER LOOKUP CLASS
  // ============================================================================

  class EmbedProviderLookup {
    /**
     * Create a new provider lookup instance.
     *
     * Stateless by design — all state lives in the singleton registry exposed
     * at `window.EmbedProviderRegistry`. Multiple instances are safe but
     * pointless; consumers should normally use the singleton at
     * `window.EmbedProviderLookup`.
     */
    constructor() {
      logInfo("EmbedProviderLookup initialised");
    }

    // ==========================================================================
    // INTERNAL HELPERS
    // ==========================================================================

    /**
     * Lazily fetch the registry. Throws a load-order error rather than a
     * generic null-deref if the registry hasn't loaded yet.
     *
     * @private
     * @returns {Object} The provider registry
     * @throws {Error} If `window.EmbedProviderRegistry` is unavailable
     */
    _getRegistry() {
      if (
        !window.EmbedProviderRegistry ||
        typeof window.EmbedProviderRegistry.get !== "function"
      ) {
        throw new Error(
          "EmbedProviderRegistry not available — script load order issue. " +
            "providers/_interface.js must load before providers/_lookup.js."
        );
      }
      return window.EmbedProviderRegistry;
    }

    // ==========================================================================
    // PUBLIC API
    // ==========================================================================

    /**
     * Resolve a model identifier to a registered provider, applying the
     * project's namespace convention from architecture decision A2.
     *
     * Lookup rule:
     *   1. If the prefix (text before first '/') is in
     *      RESERVED_PROVIDER_PREFIXES, return registry.get(prefix) — which
     *      may be null if that provider isn't loaded yet. This prevents
     *      legacy fallback for explicit-but-unconfigured Foundry namespaces.
     *   2. Otherwise (legacy OpenRouter form, bare model name, or any
     *      unrecognised prefix), fall back to the OpenRouter provider.
     *
     * Note: models with the 'local/' prefix bypass the registry entirely
     * and are handled by EmbedLocalBackend. This method does not reflect
     * that routing — it returns the OpenRouter default for 'local/...'
     * because that's the honest result of applying the lookup rule.
     * core.js's local/ guard pre-empts dispatch before this is reached.
     *
     * @param {string} modelId
     * @returns {Provider|null}
     */
    resolve(modelId) {
      const registry = this._getRegistry();

      // Defensive: missing / non-string / empty modelId → default provider.
      if (typeof modelId !== "string" || !modelId.trim()) {
        logDebug(
          "resolve() called with invalid modelId; returning default provider"
        );
        return registry.get(DEFAULT_PROVIDER_ID);
      }

      const trimmed = modelId.trim();
      const slashIndex = trimmed.indexOf("/");

      // No slash, or leading slash → no usable prefix → default provider.
      if (slashIndex <= 0) {
        logDebug(
          `resolve('${trimmed}'): no usable prefix; returning default provider`
        );
        return registry.get(DEFAULT_PROVIDER_ID);
      }

      const prefix = trimmed.slice(0, slashIndex);

      // Reserved prefix → strict lookup (may return null if not registered).
      if (RESERVED_PROVIDER_PREFIXES.has(prefix)) {
        const provider = registry.get(prefix);
        logDebug(
          `resolve('${trimmed}'): reserved prefix '${prefix}' → ${
            provider ? `provider '${provider.id}'` : "null (not registered)"
          }`
        );
        return provider;
      }

      // Unrecognised prefix → legacy fallback to default provider.
      logDebug(
        `resolve('${trimmed}'): unrecognised prefix '${prefix}'; falling back to default provider`
      );
      return registry.get(DEFAULT_PROVIDER_ID);
    }

    /**
     * Check whether a prefix is in the reserved set (i.e. would be looked up
     * strictly rather than falling back to the default provider).
     *
     * @param {string} prefix
     * @returns {boolean}
     */
    isReserved(prefix) {
      if (typeof prefix !== "string") {
        return false;
      }
      return RESERVED_PROVIDER_PREFIXES.has(prefix.trim());
    }

    /**
     * List all reserved prefixes.
     *
     * Useful for diagnostics — e.g. core.js uses this to compute the
     * "registered but loaded" / "reserved but missing" split when surfacing
     * a no-provider error.
     *
     * @returns {string[]}
     */
    getReservedPrefixes() {
      return Array.from(RESERVED_PROVIDER_PREFIXES);
    }
  }

  // ============================================================================
  // SINGLETON INSTANCE
  // ============================================================================

  const embedProviderLookup = new EmbedProviderLookup();

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  // Expose singleton instance for normal use
  window.EmbedProviderLookup = embedProviderLookup;

  // Also expose the class for testing and isolated lookup instances
  window.EmbedProviderLookupClass = EmbedProviderLookup;

  // ============================================================================
  // INITIALISATION LOG
  // ============================================================================

  logInfo("OpenRouter Embed Provider Lookup (Stage 1, Task 1.3) loaded");
  logInfo("Available as: window.EmbedProviderLookup (singleton instance)");
  logInfo("Class available as: window.EmbedProviderLookupClass");
})();
