/**
 * OpenRouter Client Module - Cache
 *
 * Handles caching of API responses.
 */
import { openRouterUtils } from "./openrouter-client-utils.js";

/**
 * Class for managing API response cache
 */
class OpenRouterCache {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Set cache entry
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   */
  set(key, value) {
    this.cache.set(key, value);
    openRouterUtils.debug("Cache entry set", { key });
  }

  /**
   * Get cache entry
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null if not found
   */
  get(key) {
    const value = this.cache.get(key);
    openRouterUtils.debug("Cache lookup", {
      key,
      hit: !!value,
    });
    return value;
  }

  /**
   * Clear the cache
   */
  clear() {
    this.cache.clear();
    openRouterUtils.info("Request cache cleared");
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Export singleton instance
export const openRouterCache = new OpenRouterCache();
