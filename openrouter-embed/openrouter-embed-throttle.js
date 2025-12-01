/**
 * OpenRouter Embed API - Throttle Handler (Stage 6 Phase 4)
 *
 * Provides request debouncing and throttling to prevent rapid-fire API calls,
 * protecting against accidental double-submissions and rate limiting.
 *
 * Features:
 * - Debounce: Delays execution until calls stop for specified duration
 * - Throttle: Ensures minimum time between executions
 * - Concurrent request limiting (maxConcurrent)
 * - Abort signal support for cancellation
 * - Callback support for throttled events
 * - Statistics tracking
 * - Timer cleanup for memory safety
 *
 * @version 1.0.0 (Stage 6 Phase 4)
 * @date 30 November 2025
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
      console.error(`[EmbedThrottle ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedThrottle WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedThrottle INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedThrottle DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // DEFAULT CONFIGURATION
  // ============================================================================

  const DEFAULT_CONFIG = {
    debounceDelay: 0, // Debounce delay in ms (0 = disabled)
    throttleInterval: 0, // Min time between requests in ms (0 = disabled)
    maxConcurrent: 1, // Max concurrent requests (Infinity = unlimited)
    onThrottled: null, // Callback: (waitTime, reason) => boolean (return false to reject)
  };

  // ============================================================================
  // EMBED THROTTLE CLASS
  // ============================================================================

  class EmbedThrottle {
    /**
     * Create a new throttle handler instance
     *
     * @param {Object} [options] - Configuration options
     */
    constructor(options = {}) {
      this._config = { ...DEFAULT_CONFIG, ...options };

      // Internal state
      this._state = {
        lastRequestTime: 0,
        activeRequests: new Map(), // requestId -> { startTime }
        debounceTimer: null,
        pendingDebounce: null,
      };

      // Statistics
      this._stats = {
        throttledCount: 0,
        totalRequests: 0,
        activeRequests: 0,
      };

      // Track timers for cleanup
      this._timers = new Set();

      // Event emitter reference (set by OpenRouterEmbed integration)
      this._emitEvent = null;

      logInfo("EmbedThrottle initialised", {
        debounceDelay: this._config.debounceDelay,
        throttleInterval: this._config.throttleInterval,
        maxConcurrent: this._config.maxConcurrent,
      });
    }

    // ==========================================================================
    // CONFIGURATION
    // ==========================================================================

    /**
     * Configure throttling behaviour
     *
     * @param {Object} options - Throttle configuration
     * @param {number} [options.debounceDelay] - Debounce delay in ms (0 = disabled)
     * @param {number} [options.throttleInterval] - Min time between requests in ms (0 = disabled)
     * @param {number} [options.maxConcurrent] - Max concurrent requests
     * @param {Function} [options.onThrottled] - Callback when request is throttled
     * @returns {EmbedThrottle} For chaining
     */
    configure(options) {
      if (options && typeof options === "object") {
        this._config = { ...this._config, ...options };
        logDebug("Configuration updated", options);
      }
      return this;
    }

    /**
     * Get current configuration
     *
     * @returns {Object} Current configuration (copy)
     */
    getConfig() {
      return { ...this._config };
    }

    /**
     * Reset throttle state and configuration
     */
    reset() {
      // Clear any pending debounce
      if (this._state.debounceTimer) {
        clearTimeout(this._state.debounceTimer);
        this._timers.delete(this._state.debounceTimer);
      }

      // Clear all tracked timers
      this._timers.forEach((timerId) => clearTimeout(timerId));
      this._timers.clear();

      // Reset state
      this._state = {
        lastRequestTime: 0,
        activeRequests: new Map(),
        debounceTimer: null,
        pendingDebounce: null,
      };

      // Reset config to defaults
      this._config = { ...DEFAULT_CONFIG };

      logInfo("Throttle state and configuration reset");
    }

    // ==========================================================================
    // STATE CHECKING
    // ==========================================================================

    /**
     * Check if a request can proceed immediately
     *
     * @returns {boolean} True if request can proceed
     */
    canProceed() {
      // Check concurrent limit
      if (this._state.activeRequests.size >= this._config.maxConcurrent) {
        logDebug("Cannot proceed: concurrent limit reached", {
          active: this._state.activeRequests.size,
          max: this._config.maxConcurrent,
        });
        return false;
      }

      // Check throttle interval
      if (this._config.throttleInterval > 0) {
        const timeSinceLast = Date.now() - this._state.lastRequestTime;
        if (timeSinceLast < this._config.throttleInterval) {
          logDebug("Cannot proceed: throttle interval not elapsed", {
            timeSinceLast,
            interval: this._config.throttleInterval,
          });
          return false;
        }
      }

      return true;
    }

    /**
     * Get time until next request is allowed
     *
     * @returns {number} Wait time in ms (0 if can proceed now)
     */
    getWaitTime() {
      let waitTime = 0;

      // Check throttle interval first (this is time-based and calculable)
      if (
        this._config.throttleInterval > 0 &&
        this._state.lastRequestTime > 0
      ) {
        const now = Date.now();
        const timeSinceLast = now - this._state.lastRequestTime;
        const throttleWait = Math.max(
          0,
          this._config.throttleInterval - timeSinceLast
        );
        waitTime = Math.max(waitTime, throttleWait);
      }

      // Check concurrent limit - if at limit, we need to wait for a slot
      // but we don't know how long, so return a minimum wait if not already waiting
      if (this._state.activeRequests.size >= this._config.maxConcurrent) {
        // If no throttle wait, return small wait time to allow polling
        if (waitTime === 0) {
          waitTime = 100;
        }
      }

      return waitTime;
    }

    // ==========================================================================
    // REQUEST TRACKING
    // ==========================================================================

    /**
     * Record that a request has started
     *
     * @returns {string} Request ID for tracking
     */
    recordRequestStart() {
      const requestId = this._generateRequestId();

      this._state.activeRequests.set(requestId, {
        startTime: Date.now(),
      });

      this._state.lastRequestTime = Date.now();
      this._stats.totalRequests++;
      this._stats.activeRequests = this._state.activeRequests.size;

      logDebug("Request started", {
        requestId,
        activeRequests: this._stats.activeRequests,
      });

      return requestId;
    }

    /**
     * Record that a request has completed
     *
     * @param {string} requestId - ID from recordRequestStart
     */
    recordRequestEnd(requestId) {
      if (!requestId) {
        logWarn("recordRequestEnd called without requestId");
        return;
      }

      const removed = this._state.activeRequests.delete(requestId);
      this._stats.activeRequests = this._state.activeRequests.size;

      if (removed) {
        logDebug("Request ended", {
          requestId,
          activeRequests: this._stats.activeRequests,
        });
      } else {
        logDebug("Request ID not found for removal", { requestId });
      }
    }

    // ==========================================================================
    // DEBOUNCE
    // ==========================================================================

    /**
     * Wrap a function with debounce logic
     *
     * Debounce delays execution until calls stop for the specified duration.
     * Each new call resets the timer.
     *
     * @param {Function} fn - Function to debounce
     * @param {number} [delay] - Override delay (uses config if not provided)
     * @returns {Function} Debounced function
     *
     * @example
     * const debouncedSearch = throttle.debounce(search, 300);
     * // Rapid calls only execute once after 300ms of inactivity
     */
    debounce(fn, delay) {
      if (typeof fn !== "function") {
        throw new Error("First argument must be a function");
      }

      const actualDelay =
        delay !== undefined ? delay : this._config.debounceDelay;

      // If debounce disabled (delay = 0), return original function
      if (actualDelay <= 0) {
        return fn;
      }

      let timerId = null;

      const debouncedFn = (...args) => {
        // Clear existing timer
        if (timerId !== null) {
          clearTimeout(timerId);
          this._timers.delete(timerId);
        }

        // Set new timer
        timerId = setTimeout(() => {
          this._timers.delete(timerId);
          timerId = null;
          fn.apply(this, args);
        }, actualDelay);

        this._timers.add(timerId);

        logDebug("Debounce timer reset", { delay: actualDelay });
      };

      // Add cancel method
      debouncedFn.cancel = () => {
        if (timerId !== null) {
          clearTimeout(timerId);
          this._timers.delete(timerId);
          timerId = null;
          logDebug("Debounced function cancelled");
        }
      };

      return debouncedFn;
    }

    // ==========================================================================
    // THROTTLE
    // ==========================================================================

    /**
     * Wrap a function with throttle logic
     *
     * Throttle ensures minimum time between executions.
     * First call executes immediately, subsequent calls during the interval are blocked.
     *
     * @param {Function} fn - Function to throttle
     * @param {number} [interval] - Override interval (uses config if not provided)
     * @returns {Function} Throttled function
     *
     * @example
     * const throttledSubmit = throttle.throttle(submit, 1000);
     * // First call executes, subsequent calls within 1s are blocked
     */
    throttle(fn, interval) {
      if (typeof fn !== "function") {
        throw new Error("First argument must be a function");
      }

      const actualInterval =
        interval !== undefined ? interval : this._config.throttleInterval;

      // If throttle disabled (interval = 0), return original function
      if (actualInterval <= 0) {
        return fn;
      }

      let lastCall = 0;

      const throttledFn = (...args) => {
        const now = Date.now();
        const timeSinceLastCall = now - lastCall;

        if (timeSinceLastCall >= actualInterval) {
          lastCall = now;
          return fn.apply(this, args);
        } else {
          const waitTime = actualInterval - timeSinceLastCall;
          this._stats.throttledCount++;

          logDebug("Function throttled", { waitTime });

          // Call onThrottled callback
          if (typeof this._config.onThrottled === "function") {
            try {
              this._config.onThrottled(waitTime, "throttle_interval");
            } catch (error) {
              logWarn("onThrottled callback threw error:", error);
            }
          }

          // Emit throttled event
          if (this._emitEvent) {
            try {
              this._emitEvent("throttled", {
                waitTime,
                reason: "throttle_interval",
              });
            } catch (error) {
              logWarn("Error emitting throttled event:", error);
            }
          }

          return undefined;
        }
      };

      // Add reset method
      throttledFn.reset = () => {
        lastCall = 0;
        logDebug("Throttle timer reset");
      };

      return throttledFn;
    }

    // ==========================================================================
    // ACQUIRE/RELEASE PATTERN
    // ==========================================================================

    /**
     * Acquire permission to make a request (async, waits if needed)
     *
     * @param {Object} [options] - Options
     * @param {AbortSignal} [options.signal] - Abort signal for cancellation
     * @returns {Promise<string>} Resolves with request ID when permitted
     * @throws {Error} If throttled and onThrottled returns false, or if aborted
     *
     * @example
     * try {
     *   const requestId = await throttle.acquire({ signal: abortController.signal });
     *   // ... make request ...
     *   throttle.release(requestId);
     * } catch (error) {
     *   if (error.name === 'AbortError') {
     *     console.log('Request was cancelled');
     *   }
     * }
     */
    async acquire(options = {}) {
      const { signal } = options;

      // Check if already aborted
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      // If can proceed immediately, do so
      if (this.canProceed()) {
        logDebug("Acquire: can proceed immediately");
        return this.recordRequestStart();
      }

      // Need to wait
      const waitTime = this.getWaitTime();
      this._stats.throttledCount++;

      logDebug("Acquire: need to wait", { waitTime });

      // Call onThrottled callback - if it returns false, reject
      if (typeof this._config.onThrottled === "function") {
        try {
          const shouldWait = this._config.onThrottled(waitTime, "acquire");
          if (shouldWait === false) {
            const error = new Error(`Request throttled, wait ${waitTime}ms`);
            error.waitTime = waitTime;
            error.reason = "onThrottled_rejected";
            throw error;
          }
        } catch (error) {
          if (error.reason === "onThrottled_rejected") {
            throw error;
          }
          logWarn("onThrottled callback threw error:", error);
        }
      }

      // Emit throttled event
      if (this._emitEvent) {
        try {
          this._emitEvent("throttled", { waitTime, reason: "rate_limit" });
        } catch (error) {
          logWarn("Error emitting throttled event:", error);
        }
      }

      // Wait then acquire
      await this._wait(waitTime, signal);

      // After waiting, check again (could have been released during wait)
      // If still can't proceed, wait for a slot with polling
      let pollAttempts = 0;
      const maxPollAttempts = 50; // 5 seconds max polling

      while (!this.canProceed() && pollAttempts < maxPollAttempts) {
        if (signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        await this._wait(100, signal);
        pollAttempts++;
      }

      if (!this.canProceed()) {
        throw new Error(
          "Timeout waiting for request slot after " +
            maxPollAttempts * 100 +
            "ms"
        );
      }

      // Emit released event
      const requestId = this.recordRequestStart();

      if (this._emitEvent) {
        try {
          this._emitEvent("throttleReleased", { requestId });
        } catch (error) {
          logWarn("Error emitting throttleReleased event:", error);
        }
      }

      return requestId;
    }

    /**
     * Release a request slot
     *
     * @param {string} requestId - ID from acquire()
     */
    release(requestId) {
      this.recordRequestEnd(requestId);
    }

    // ==========================================================================
    // STATISTICS
    // ==========================================================================

    /**
     * Get throttle statistics
     *
     * @returns {Object} Statistics object
     * @property {number} throttledCount - Total times requests were throttled
     * @property {number} totalRequests - Total requests that proceeded
     * @property {number} activeRequests - Currently active requests
     */
    getStats() {
      return { ...this._stats };
    }

    /**
     * Reset statistics
     */
    resetStats() {
      this._stats = {
        throttledCount: 0,
        totalRequests: 0,
        activeRequests: this._state.activeRequests.size,
      };
      logDebug("Statistics reset");
    }

    // ==========================================================================
    // CLEANUP
    // ==========================================================================

    /**
     * Clean up all timers and state
     *
     * Call this when the throttle handler is no longer needed
     * to prevent memory leaks.
     */
    cleanup() {
      // Clear all tracked timers
      this._timers.forEach((timerId) => clearTimeout(timerId));
      this._timers.clear();

      // Clear debounce timer
      if (this._state.debounceTimer) {
        clearTimeout(this._state.debounceTimer);
      }

      // Clear active requests
      this._state.activeRequests.clear();

      // Reset state
      this._state = {
        lastRequestTime: 0,
        activeRequests: new Map(),
        debounceTimer: null,
        pendingDebounce: null,
      };

      this._stats.activeRequests = 0;

      logInfo("EmbedThrottle cleaned up");
    }

    // ==========================================================================
    // INTERNAL METHODS
    // ==========================================================================

    /**
     * Generate unique request ID
     *
     * @private
     * @returns {string} Request ID
     */
    _generateRequestId() {
      return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    /**
     * Wait for specified delay, checking abort signal
     *
     * @private
     * @param {number} delay - Delay in milliseconds
     * @param {AbortSignal} [signal] - Optional abort signal
     * @returns {Promise<void>}
     */
    _wait(delay, signal) {
      return new Promise((resolve, reject) => {
        // Check if already aborted
        if (signal?.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }

        const timeoutId = setTimeout(() => {
          this._timers.delete(timeoutId);
          if (signal) {
            signal.removeEventListener("abort", onAbort);
          }
          resolve();
        }, delay);

        this._timers.add(timeoutId);

        // Set up abort listener
        const onAbort = () => {
          clearTimeout(timeoutId);
          this._timers.delete(timeoutId);
          reject(new DOMException("Aborted", "AbortError"));
        };

        if (signal) {
          signal.addEventListener("abort", onAbort, { once: true });
        }
      });
    }
  }

  // ============================================================================
  // SINGLETON INSTANCE
  // ============================================================================

  const embedThrottle = new EmbedThrottle();

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  // Expose singleton instance for convenience
  window.EmbedThrottle = embedThrottle;

  // Also expose class for testing and custom instances
  window.EmbedThrottleClass = EmbedThrottle;

  // ============================================================================
  // INITIALIZATION LOG
  // ============================================================================

  logInfo("OpenRouter Embed Throttle Handler (Stage 6 Phase 4) loaded");
  logInfo("Available as: window.EmbedThrottle (singleton instance)");
  logInfo("Class available as: window.EmbedThrottleClass");
})();
