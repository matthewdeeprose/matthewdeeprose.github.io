/**
 * OpenRouter Embed API - Provider Interface (Stage 1, Task 1.1)
 *
 * Defines the contract that every concrete AI provider must satisfy and
 * exposes a registry singleton for storing and retrieving Provider objects
 * keyed by their `id`.
 *
 * This module is the contract definition only. It does not implement any
 * concrete provider — those live in sibling files under `providers/`
 * (e.g. `providers/openrouter.js`, `providers/azure-openai-v1.js`) and
 * register themselves with `window.EmbedProviderRegistry` at load time.
 *
 * Features:
 * - Provider contract documented as a JSDoc @typedef
 * - EmbedProviderRegistry class with register / get / has / unregister / list / clear
 * - Validation of registered providers (id, four wire methods, capabilities object)
 * - Singleton instance plus class globally exposed
 *
 * @version 1.0.0 (Stage 1, Task 1.1)
 * @date 6 May 2026
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
      console.error(`[EmbedProviderRegistry ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedProviderRegistry WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedProviderRegistry INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedProviderRegistry DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // PROVIDER CONTRACT (DOCUMENTATION ONLY)
  // ============================================================================

  /**
   * @typedef {Object} ProviderCapabilities
   *
   * Provider-level capability flags. These describe what the provider's API
   * surface can support in general, NOT what any specific model offers.
   *
   * Example: the OpenRouter provider's `images` is `true` because OpenRouter
   * supports vision models in general — even though many individual OpenRouter
   * models do not accept image inputs. Per-deployment capability variation is
   * declared separately on each entry of `config.models[i].capabilities` and is
   * the responsibility of the consumer / model selector, not the provider.
   *
   * @property {boolean} streaming - Provider supports server-sent-event streaming responses
   * @property {boolean} images    - Provider's API surface accepts image content parts
   * @property {boolean} pdf       - Provider's API surface accepts PDF attachments natively
   * @property {boolean} reasoning - Provider exposes a separate reasoning / thinking content channel
   * @property {boolean} toolCalls - Provider supports tool / function calling
   */

  /**
   * @typedef {Object} Provider
   *
   * The contract every concrete provider must satisfy. Concrete providers are
   * registered with the singleton `EmbedProviderRegistry` and looked up at
   * dispatch time by their `id`.
   *
   * The four wire methods translate between the library's canonical request /
   * response shapes and the upstream provider's wire format. The library's
   * other modules (retry, cache, queue, throttle, events, file handling,
   * progress) operate on canonical shapes only and are provider-agnostic.
   *
   * @property {string}   id                  Stable identifier, e.g. 'openrouter', 'azure-openai'
   * @property {Function} buildRequest        (messages, options) => wire-format body object
   * @property {Function} endpoint            (model, options) => { url: string, headers: object }
   * @property {Function} parseStreamChunk    (rawSSE) => canonical delta (input format provider-defined)
   * @property {Function} parseResponse       (json) => canonical response object
   * @property {ProviderCapabilities} capabilities  Provider-level capability flags (see typedef)
   */

  // ============================================================================
  // EMBED PROVIDER REGISTRY CLASS
  // ============================================================================

  class EmbedProviderRegistry {
    /**
     * Create a new provider registry instance.
     *
     * Note that consumers should normally use the singleton exposed at
     * `window.EmbedProviderRegistry`; the class is exposed only for testing
     * and for tools that want an isolated registry instance.
     */
    constructor() {
      // Use Map for O(1) lookup by provider id; mirrors Map usage in
      // openrouter-embed-events.js for handler storage.
      this._providers = new Map();

      logInfo("EmbedProviderRegistry initialised");
    }

    // ==========================================================================
    // REGISTRATION METHODS
    // ==========================================================================

    /**
     * Register a provider.
     *
     * Validates that the provider has a non-empty string `id`, that the four
     * wire methods (`buildRequest`, `endpoint`, `parseStreamChunk`,
     * `parseResponse`) are functions, and that `capabilities` is an object.
     * Deeper conformance to the typedef is not enforced at runtime.
     *
     * @param {Provider} provider - The provider object to register
     * @returns {void}
     * @throws {Error} If validation fails or a provider with the same id is already registered
     *
     * @example
     * window.EmbedProviderRegistry.register({
     *   id: 'openrouter',
     *   buildRequest: (messages, options) => ({ ... }),
     *   endpoint: (model, options) => ({ url: '...', headers: {} }),
     *   parseStreamChunk: (rawSSE) => ({ ... }),
     *   parseResponse: (json) => ({ ... }),
     *   capabilities: { streaming: true, images: true, pdf: true, reasoning: true, toolCalls: true }
     * });
     */
    register(provider) {
      // Validate that provider is an object at all
      if (provider === null || typeof provider !== "object") {
        throw new Error("Provider must be a non-null object");
      }

      // Validate id
      if (typeof provider.id !== "string" || !provider.id.trim()) {
        throw new Error("Provider.id must be a non-empty string");
      }

      const providerId = provider.id.trim();

      // Validate the four wire methods
      const requiredMethods = [
        "buildRequest",
        "endpoint",
        "parseStreamChunk",
        "parseResponse",
      ];
      for (const methodName of requiredMethods) {
        if (typeof provider[methodName] !== "function") {
          throw new Error(
            `Provider.${methodName} must be a function (provider id: '${providerId}')`
          );
        }
      }

      // Validate capabilities is an object (not null, not array)
      if (
        provider.capabilities === null ||
        typeof provider.capabilities !== "object" ||
        Array.isArray(provider.capabilities)
      ) {
        throw new Error(
          `Provider.capabilities must be an object (provider id: '${providerId}')`
        );
      }

      // Reject duplicate registration
      if (this._providers.has(providerId)) {
        throw new Error(
          `Provider with id '${providerId}' is already registered`
        );
      }

      this._providers.set(providerId, provider);

      logInfo(`Provider registered: '${providerId}'`, {
        totalProviders: this._providers.size,
      });
    }

    /**
     * Remove a provider from the registry.
     *
     * @param {string} id - The provider id to remove
     * @returns {boolean} True if a provider was removed, false if the id was not registered
     *
     * @example
     * const removed = window.EmbedProviderRegistry.unregister('openrouter');
     */
    unregister(id) {
      if (typeof id !== "string" || !id.trim()) {
        logWarn("unregister() called with invalid id");
        return false;
      }

      const providerId = id.trim();
      const removed = this._providers.delete(providerId);

      if (removed) {
        logDebug(`Provider unregistered: '${providerId}'`, {
          remainingProviders: this._providers.size,
        });
      } else {
        logDebug(`unregister() — no provider found with id '${providerId}'`);
      }

      return removed;
    }

    // ==========================================================================
    // LOOKUP METHODS
    // ==========================================================================

    /**
     * Retrieve a registered provider by id.
     *
     * @param {string} id - The provider id to look up
     * @returns {Provider|null} The provider object, or null if no provider with that id is registered
     *
     * @example
     * const provider = window.EmbedProviderRegistry.get('openrouter');
     * if (provider) provider.buildRequest(messages, options);
     */
    get(id) {
      if (typeof id !== "string" || !id.trim()) {
        return null;
      }

      const provider = this._providers.get(id.trim());
      return provider === undefined ? null : provider;
    }

    /**
     * Check whether a provider is registered with the given id.
     *
     * @param {string} id - The provider id to check
     * @returns {boolean} True if a provider with that id is registered
     *
     * @example
     * if (window.EmbedProviderRegistry.has('azure-openai')) { ... }
     */
    has(id) {
      if (typeof id !== "string" || !id.trim()) {
        return false;
      }

      return this._providers.has(id.trim());
    }

    /**
     * List the ids of all registered providers.
     *
     * Returns ids only — mirroring Map.keys() convention. Callers that want
     * the full provider objects can do
     * `registry.list().map(id => registry.get(id))`.
     *
     * @returns {string[]} Array of registered provider ids; empty array if none registered
     *
     * @example
     * const ids = window.EmbedProviderRegistry.list();
     * console.log('Available providers:', ids.join(', '));
     */
    list() {
      return Array.from(this._providers.keys());
    }

    // ==========================================================================
    // CLEANUP METHODS
    // ==========================================================================

    /**
     * Remove all registered providers.
     *
     * Primarily for test cleanup. Production code should not normally call
     * this, since concrete providers register themselves at module load and
     * the registry is expected to remain populated for the lifetime of the page.
     *
     * @returns {void}
     *
     * @example
     * // In a test teardown:
     * window.EmbedProviderRegistry.clear();
     */
    clear() {
      const previousSize = this._providers.size;
      this._providers.clear();
      logDebug(`Registry cleared (${previousSize} providers removed)`);
    }
  }

  // ============================================================================
  // SINGLETON INSTANCE
  // ============================================================================

  const embedProviderRegistry = new EmbedProviderRegistry();

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  // Expose singleton instance for normal use
  window.EmbedProviderRegistry = embedProviderRegistry;

  // Also expose the class for testing and isolated registry instances
  window.EmbedProviderRegistryClass = EmbedProviderRegistry;

  // ============================================================================
  // INITIALISATION LOG
  // ============================================================================

  logInfo("OpenRouter Embed Provider Registry (Stage 1, Task 1.1) loaded");
  logInfo("Available as: window.EmbedProviderRegistry (singleton instance)");
  logInfo("Class available as: window.EmbedProviderRegistryClass");
})();
