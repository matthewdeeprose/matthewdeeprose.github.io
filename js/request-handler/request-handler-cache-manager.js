import { CONFIG } from "../config.js";
/**
 * @fileoverview Cache Manager for request handling
 * Manages caching of API responses
 */

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
      // NO `tokenCounter.recordAttempt` HERE, AND IT MUST NOT BE RESTORED.
      //
      // It used to run on every hit whose cached body carried `usage`, passing
      // `cached.data.requestId` — and `cached.data` is the raw API response,
      // which has never carried a `requestId`. `recordAttempt` throws a
      // `TokenCounterError` for an id it holds no state for, and this `get` is
      // called ABOVE `executeRequest`'s try (request-handler-index.js:95), so the
      // throw left the method entirely. Every cache hit on a real response was a
      // hard error instead of an instant reply, for the whole CACHE_DURATION hour.
      //
      // Deleting it costs nothing a user sees. `updateStateWithAttempt` in
      // token-counter-tracker.js adds to totalPromptTokens / totalCompletionTokens
      // only when `isCached` is false, so a cached attempt moved neither total; its
      // sole effect was one diagnostic row in `state.attempts`, and that row was
      // unreachable anyway, because producing it needs a state that exists — which
      // is exactly the case that threw. Measured two-sided 22 September 2026, with
      // a non-cached attempt moving the totals as the positive control. The `usage`
      // check went with it: it guarded this call and nothing else.
      //
      // Register items 84 (origin) and 105 (drive).
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
