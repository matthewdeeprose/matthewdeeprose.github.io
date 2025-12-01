/**
 * OpenRouter Embed API - Response Caching (Stage 6 Phase 5)
 *
 * Caches responses to avoid duplicate API calls for identical requests,
 * providing cost savings and instant responses for repeated queries.
 *
 * Features:
 * - LRU eviction when cache is full
 * - TTL expiration for cached entries
 * - Custom key generator support
 * - Model exclusion list
 * - Cache statistics tracking
 * - Event emission for cache operations
 *
 * @version 6.5.0
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
      console.error(`[EmbedCache ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedCache WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedCache INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedCache DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // DEFAULT CONFIGURATION
  // ============================================================================

  const DEFAULT_CONFIG = {
    enabled: false, // Disabled by default (opt-in for cost savings)
    maxEntries: 100, // Maximum cached responses
    ttl: 3600000, // Time-to-live in ms (1 hour)
    keyGenerator: null, // Custom key generator: (request) => string
    storage: "memory", // 'memory' or 'sessionStorage'
    excludeModels: [], // Models to never cache
    onCacheHit: null, // Callback: (key, response) => void
    onCacheMiss: null, // Callback: (key) => void
  };

  // ============================================================================
  // EMBED CACHE CLASS
  // ============================================================================

  class EmbedCache {
    /**
     * Create a new EmbedCache instance
     *
     * @param {Object} [config] - Configuration options
     */
    constructor(config = {}) {
      logInfo("Initialising EmbedCache...");

      // Configuration
      this._config = { ...DEFAULT_CONFIG, ...config };

      // Cache storage (Map for O(1) access)
      this._cache = new Map();

      // Statistics
      this._stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        evictions: 0,
      };

      // Event emitter connection (will be set by OpenRouterEmbed)
      this._emitEvent = null;

      logInfo("EmbedCache initialised", {
        enabled: this._config.enabled,
        maxEntries: this._config.maxEntries,
        ttl: this._config.ttl,
        storage: this._config.storage,
      });
    }

    // ==========================================================================
    // CONFIGURATION
    // ==========================================================================

    /**
     * Configure cache behaviour
     *
     * @param {Object} options - Cache configuration
     * @param {boolean} [options.enabled] - Enable caching
     * @param {number} [options.maxEntries] - Maximum cached responses
     * @param {number} [options.ttl] - Time-to-live in ms
     * @param {Function} [options.keyGenerator] - Custom key generator: (request) => string
     * @param {string} [options.storage] - 'memory' or 'sessionStorage'
     * @param {string[]} [options.excludeModels] - Models to never cache
     * @param {Function} [options.onCacheHit] - Callback: (key, response) => void
     * @param {Function} [options.onCacheMiss] - Callback: (key) => void
     * @returns {EmbedCache} For chaining
     *
     * @example
     * cache.configure({
     *   enabled: true,
     *   maxEntries: 50,
     *   ttl: 1800000 // 30 minutes
     * });
     */
    configure(options) {
      if (!options || typeof options !== "object") {
        logWarn("configure called with invalid options");
        return this;
      }

      this._config = { ...this._config, ...options };

      logDebug("Cache configuration updated", {
        enabled: this._config.enabled,
        maxEntries: this._config.maxEntries,
        ttl: this._config.ttl,
      });

      return this;
    }

    /**
     * Get current configuration
     *
     * @returns {Object} Current cache configuration
     *
     * @example
     * const config = cache.getConfig();
     * console.log('TTL:', config.ttl);
     */
    getConfig() {
      return { ...this._config };
    }

    // ==========================================================================
    // CACHE KEY GENERATION
    // ==========================================================================

    /**
     * Generate cache key from request
     *
     * Creates a deterministic key from request properties.
     * Uses custom keyGenerator if provided.
     *
     * @param {Object} request - Request object
     * @param {string} [request.userPrompt] - User prompt
     * @param {string} [request.systemPrompt] - System prompt
     * @param {string} [request.model] - Model name
     * @param {number} [request.temperature] - Temperature
     * @param {number} [request.max_tokens] - Max tokens
     * @returns {string} Cache key
     *
     * @example
     * const key = cache.generateKey({
     *   userPrompt: 'Hello',
     *   model: 'gpt-4'
     * });
     */
    generateKey(request) {
      // Use custom generator if provided
      if (typeof this._config.keyGenerator === "function") {
        try {
          const customKey = this._config.keyGenerator(request);
          if (typeof customKey === "string" && customKey.length > 0) {
            logDebug("Using custom key generator", { key: customKey });
            return customKey;
          }
          logWarn("Custom key generator returned invalid key, using default");
        } catch (error) {
          logWarn("Custom key generator error, using default:", error);
        }
      }

      // Default key generation
      const keyParts = {
        userPrompt: request.userPrompt || "",
        systemPrompt: request.systemPrompt || "",
        model: request.model || "",
        temperature: request.temperature ?? 0.7,
        maxTokens: request.max_tokens ?? 2000,
      };

      const keyString = JSON.stringify(keyParts);
      const hash = this._hashString(keyString);

      logDebug("Generated cache key", {
        key: hash,
        promptLength: keyParts.userPrompt.length,
      });

      return hash;
    }

    /**
     * Create a simple hash from string
     *
     * @private
     * @param {string} str - String to hash
     * @returns {string} Hash string
     */
    _hashString(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return "cache_" + Math.abs(hash).toString(36);
    }

    // ==========================================================================
    // CACHE OPERATIONS
    // ==========================================================================

    /**
     * Get cached response
     *
     * @param {Object} request - Request object (userPrompt, systemPrompt, model, etc.)
     * @returns {Object|null} Cached response or null if not found/expired
     *
     * @example
     * const cached = cache.get({ userPrompt: 'Hello', model: 'gpt-4' });
     * if (cached) {
     *   console.log('Cache hit!', cached.text);
     * }
     */
    get(request) {
      if (!this._config.enabled) {
        logDebug("Cache disabled, returning null");
        return null;
      }

      const key = this.generateKey(request);
      const entry = this._cache.get(key);

      // Not found
      if (!entry) {
        this._stats.misses++;
        logDebug("Cache miss - not found", { key });

        this._emitCacheEvent("cacheMiss", { key, reason: "not_found" });
        this._invokeCallback("onCacheMiss", key);

        return null;
      }

      // Check expiration
      if (this._isExpired(entry)) {
        this._cache.delete(key);
        this._stats.misses++;
        this._stats.evictions++;

        logDebug("Cache miss - expired", {
          key,
          age: Date.now() - entry.timestamp,
        });

        this._emitCacheEvent("cacheMiss", { key, reason: "expired" });
        this._emitCacheEvent("cacheEvict", { key, reason: "expired" });
        this._invokeCallback("onCacheMiss", key);

        return null;
      }

      // Check if model is excluded
      if (this._isModelExcluded(request.model)) {
        this._stats.misses++;
        logDebug("Cache miss - model excluded", { key, model: request.model });

        this._emitCacheEvent("cacheMiss", { key, reason: "excluded_model" });
        this._invokeCallback("onCacheMiss", key);

        return null;
      }

      // Cache hit - update access time for LRU
      entry.accessTime = Date.now();
      this._stats.hits++;

      const age = Date.now() - entry.timestamp;
      logDebug("Cache hit", { key, age });

      this._emitCacheEvent("cacheHit", {
        key,
        response: entry.response,
        age,
      });
      this._invokeCallback("onCacheHit", key, entry.response);

      return entry.response;
    }

    /**
     * Cache a response
     *
     * @param {Object} request - Request object used as cache key
     * @param {Object} response - Response to cache
     * @param {Object} [options] - Override options
     * @param {number} [options.ttl] - Override TTL for this entry
     * @returns {boolean} True if cached successfully
     *
     * @example
     * cache.set(
     *   { userPrompt: 'Hello', model: 'gpt-4' },
     *   { text: 'Hi there!', ... }
     * );
     */
    set(request, response, options = {}) {
      if (!this._config.enabled) {
        logDebug("Cache disabled, not caching");
        return false;
      }

      // Don't cache if model is excluded
      if (this._isModelExcluded(request.model)) {
        logDebug("Model excluded from caching", { model: request.model });
        return false;
      }

      // Evict if at capacity
      if (this._cache.size >= this._config.maxEntries) {
        this._evictLRU();
      }

      const key = this.generateKey(request);
      const ttl = options.ttl ?? this._config.ttl;
      const now = Date.now();

      const entry = {
        response,
        timestamp: now,
        accessTime: now,
        ttl,
      };

      this._cache.set(key, entry);
      this._stats.sets++;

      logDebug("Response cached", { key, ttl });

      this._emitCacheEvent("cacheSet", { key, ttl });

      return true;
    }

    /**
     * Check if request is cached
     *
     * @param {Object} request - Request object
     * @returns {boolean} True if cached and not expired
     *
     * @example
     * if (cache.has({ userPrompt: 'Hello', model: 'gpt-4' })) {
     *   console.log('Response is cached');
     * }
     */
    has(request) {
      if (!this._config.enabled) {
        return false;
      }

      const key = this.generateKey(request);
      const entry = this._cache.get(key);

      if (!entry) {
        return false;
      }

      if (this._isExpired(entry)) {
        // Clean up expired entry
        this._cache.delete(key);
        this._stats.evictions++;
        this._emitCacheEvent("cacheEvict", { key, reason: "expired" });
        return false;
      }

      if (this._isModelExcluded(request.model)) {
        return false;
      }

      return true;
    }

    /**
     * Remove cached response
     *
     * @param {Object} request - Request object
     * @returns {boolean} True if removed
     *
     * @example
     * cache.delete({ userPrompt: 'Hello', model: 'gpt-4' });
     */
    delete(request) {
      const key = this.generateKey(request);
      const existed = this._cache.has(key);

      if (existed) {
        this._cache.delete(key);
        logDebug("Cache entry deleted", { key });
        this._emitCacheEvent("cacheEvict", { key, reason: "manual" });
      }

      return existed;
    }

    /**
     * Clear all cached responses
     *
     * @example
     * cache.clear();
     */
    clear() {
      const size = this._cache.size;
      this._cache.clear();

      logInfo("Cache cleared", { entriesRemoved: size });

      if (size > 0) {
        this._emitCacheEvent("cacheEvict", { key: "*", reason: "clear_all" });
      }
    }

    /**
     * Clean up expired entries
     *
     * @returns {number} Number of entries removed
     *
     * @example
     * const removed = cache.cleanup();
     * console.log(`Removed ${removed} expired entries`);
     */
    cleanup() {
      let removed = 0;

      for (const [key, entry] of this._cache) {
        if (this._isExpired(entry)) {
          this._cache.delete(key);
          this._stats.evictions++;
          removed++;
          this._emitCacheEvent("cacheEvict", { key, reason: "cleanup" });
        }
      }

      if (removed > 0) {
        logInfo("Cache cleanup completed", { entriesRemoved: removed });
      }

      return removed;
    }

    // ==========================================================================
    // STATISTICS
    // ==========================================================================

    /**
     * Get cache statistics
     *
     * @returns {Object} { size, hits, misses, hitRate, sets, evictions }
     *
     * @example
     * const stats = cache.getStats();
     * console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
     */
    getStats() {
      const total = this._stats.hits + this._stats.misses;
      const hitRate = total > 0 ? this._stats.hits / total : 0;

      return {
        size: this._cache.size,
        hits: this._stats.hits,
        misses: this._stats.misses,
        hitRate,
        sets: this._stats.sets,
        evictions: this._stats.evictions,
      };
    }

    /**
     * Reset statistics
     *
     * @example
     * cache.resetStats();
     */
    resetStats() {
      this._stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        evictions: 0,
      };

      logDebug("Cache statistics reset");
    }

    // ==========================================================================
    // PRIVATE HELPERS
    // ==========================================================================

    /**
     * Check if entry is expired
     *
     * @private
     * @param {Object} entry - Cache entry
     * @returns {boolean} True if expired
     */
    _isExpired(entry) {
      if (!entry || !entry.timestamp) return true;

      // Use entry-specific TTL if set, otherwise use config TTL
      const ttl = entry.ttl ?? this._config.ttl;
      const age = Date.now() - entry.timestamp;

      return age > ttl;
    }

    /**
     * Check if model is in exclusion list
     *
     * @private
     * @param {string} model - Model name
     * @returns {boolean} True if model should not be cached
     */
    _isModelExcluded(model) {
      if (!model || !Array.isArray(this._config.excludeModels)) {
        return false;
      }

      return this._config.excludeModels.includes(model);
    }

    /**
     * Evict least recently used entry
     *
     * @private
     */
    _evictLRU() {
      if (this._cache.size === 0) return;

      // Find least recently accessed entry
      let oldestKey = null;
      let oldestTime = Infinity;

      for (const [key, entry] of this._cache) {
        if (entry.accessTime < oldestTime) {
          oldestTime = entry.accessTime;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this._cache.delete(oldestKey);
        this._stats.evictions++;

        logDebug("LRU eviction", { key: oldestKey });

        this._emitCacheEvent("cacheEvict", { key: oldestKey, reason: "lru" });
      }
    }

    /**
     * Emit cache event
     *
     * @private
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    _emitCacheEvent(event, data) {
      if (typeof this._emitEvent === "function") {
        try {
          this._emitEvent(event, data);
        } catch (error) {
          logWarn(`Error emitting cache event '${event}':`, error);
        }
      }
    }

    /**
     * Invoke configuration callback
     *
     * @private
     * @param {string} callbackName - Callback name (onCacheHit, onCacheMiss)
     * @param {...any} args - Callback arguments
     */
    _invokeCallback(callbackName, ...args) {
      const callback = this._config[callbackName];
      if (typeof callback === "function") {
        try {
          callback(...args);
        } catch (error) {
          logWarn(`Error in ${callbackName} callback:`, error);
        }
      }
    }

    /**
     * Reset cache to default state
     *
     * @example
     * cache.reset();
     */
    reset() {
      this._config = { ...DEFAULT_CONFIG };
      this._cache.clear();
      this.resetStats();

      logInfo("Cache reset to defaults");
    }
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  // Singleton for convenience
  const embedCache = new EmbedCache();
  window.EmbedCache = embedCache;

  // Class for testing and custom instances
  window.EmbedCacheClass = EmbedCache;

  logInfo("EmbedCache module loaded");
})();
