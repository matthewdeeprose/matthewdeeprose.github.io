import { CONFIG } from "../config.js";
/**
 * @fileoverview Cache Manager for request handling
 * Manages caching of API responses with token usage tracking
 */

import { tokenCounter } from "../token-counter/token-counter-index.js";

export class CacheManager {
  constructor() {
    this.cache = new Map();
  }

  getCacheKey(messages, model) {
    return JSON.stringify({ messages, model });
  }

  get(messages, model) {
    const key = this.getCacheKey(messages, model);
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < CONFIG.CACHE_DURATION) {
      // Track token usage for cached response
      if (cached.data.usage) {
        tokenCounter.recordAttempt(
          cached.data.requestId,
          cached.data.usage,
          model,
          true
        );
      }
      return cached.data;
    }

    return null;
  }

  set(messages, model, data) {
    const key = this.getCacheKey(messages, model);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }
}
