/**
 * OpenRouter Embed API - Retry Handler (Stage 6 Phase 1)
 *
 * Provides automatic retry logic with exponential backoff for failed requests.
 * Handles transient network failures and rate limiting gracefully.
 *
 * Features:
 * - Configurable retry attempts and delays
 * - Exponential backoff with jitter to prevent thundering herd
 * - Retryable error detection (HTTP status codes and error types)
 * - Abort signal support for cancellation
 * - Callback support for retry events
 * - Statistics tracking
 *
 * @version 1.0.0 (Stage 6 Phase 1)
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
      console.error(`[EmbedRetryHandler ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedRetryHandler WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedRetryHandler INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedRetryHandler DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // DEFAULT CONFIGURATION
  // ============================================================================

  const DEFAULT_CONFIG = {
    enabled: true,
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
    retryableStatuses: [408, 429, 500, 502, 503, 504],
    retryableErrors: [
      "ETIMEDOUT",
      "ECONNRESET",
      "ECONNREFUSED",
      "NETWORK_ERROR",
    ],
    onRetry: null,
  };

  // ============================================================================
  // EMBED RETRY HANDLER CLASS
  // ============================================================================

  class EmbedRetryHandler {
    /**
     * Create a new retry handler instance
     *
     * @param {Object} [options] - Configuration options
     */
    constructor(options = {}) {
      this._config = { ...DEFAULT_CONFIG, ...options };
      this._stats = {
        totalRetries: 0,
        successfulRetries: 0,
        failedAfterRetries: 0,
      };

      logInfo("EmbedRetryHandler initialised", {
        enabled: this._config.enabled,
        maxRetries: this._config.maxRetries,
      });
    }

    // ==========================================================================
    // CONFIGURATION
    // ==========================================================================

    /**
     * Configure retry behaviour
     *
     * @param {Object} options - Retry configuration
     * @param {boolean} [options.enabled] - Enable automatic retry
     * @param {number} [options.maxRetries] - Maximum retry attempts
     * @param {number} [options.initialDelay] - First retry delay (ms)
     * @param {number} [options.maxDelay] - Maximum delay cap (ms)
     * @param {number} [options.backoffMultiplier] - Delay multiplier each retry
     * @param {boolean} [options.jitter] - Add randomness to prevent thundering herd
     * @param {number[]} [options.retryableStatuses] - HTTP status codes to retry
     * @param {string[]} [options.retryableErrors] - Error codes to retry
     * @param {Function} [options.onRetry] - Callback: (attempt, delay, error) => void
     * @returns {EmbedRetryHandler} For chaining
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
     * Reset to default configuration
     */
    reset() {
      this._config = { ...DEFAULT_CONFIG };
      logInfo("Configuration reset to defaults");
    }

    // ==========================================================================
    // ERROR DETECTION
    // ==========================================================================

    /**
     * Check if an error is retryable
     *
     * @param {Error} error - Error to check
     * @returns {boolean} True if error can be retried
     */
    isRetryable(error) {
      if (!error) {
        return false;
      }

      // Check HTTP status
      if (
        error.status &&
        this._config.retryableStatuses.includes(error.status)
      ) {
        logDebug(`Status ${error.status} is retryable`);
        return true;
      }

      // Check error codes
      if (error.code && this._config.retryableErrors.includes(error.code)) {
        logDebug(`Error code ${error.code} is retryable`);
        return true;
      }

      // Check for network errors in message
      const message = (error.message || "").toLowerCase();
      if (
        message.includes("network") ||
        message.includes("timeout") ||
        message.includes("fetch failed") ||
        message.includes("connection")
      ) {
        logDebug("Network error detected in message, is retryable");
        return true;
      }

      // Check for specific non-retryable status codes (client errors)
      if (error.status && error.status >= 400 && error.status < 500) {
        // Most 4xx errors should not be retried (except 408, 429 which are in retryableStatuses)
        if (!this._config.retryableStatuses.includes(error.status)) {
          logDebug(`Status ${error.status} is not retryable (client error)`);
          return false;
        }
      }

      return false;
    }

    // ==========================================================================
    // DELAY CALCULATION
    // ==========================================================================

    /**
     * Calculate delay for a given attempt
     *
     * Uses exponential backoff with optional jitter to prevent thundering herd.
     *
     * @param {number} attempt - Current attempt number (0-based)
     * @returns {number} Delay in milliseconds
     */
    calculateDelay(attempt) {
      // Calculate exponential delay
      let delay =
        this._config.initialDelay *
        Math.pow(this._config.backoffMultiplier, attempt);

      // Cap at maxDelay
      delay = Math.min(delay, this._config.maxDelay);

      // Add jitter if enabled (±25% randomness)
      if (this._config.jitter) {
        const jitterRange = delay * 0.25;
        delay += Math.random() * jitterRange * 2 - jitterRange;
      }

      // Ensure positive integer
      return Math.max(1, Math.round(delay));
    }

    // ==========================================================================
    // EXECUTION
    // ==========================================================================

    /**
     * Execute a function with retry logic
     *
     * @param {Function} fn - Async function to execute
     * @param {Object} [options] - Override options for this call
     * @param {AbortSignal} [signal] - Optional abort signal
     * @returns {Promise<any>} Result of successful execution
     * @throws {Error} If all retries exhausted or non-retryable error
     *
     * @example
     * const result = await retryHandler.execute(
     *   async () => await fetch(url),
     *   { maxRetries: 5 },
     *   abortController.signal
     * );
     */
    async execute(fn, options = {}, signal = null) {
      const config = { ...this._config, ...options };

      // If retry disabled, just execute once
      if (!config.enabled) {
        logDebug("Retry disabled, executing once");
        return fn();
      }

      let lastError;

      for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        // Check for abort before each attempt
        if (signal?.aborted) {
          logInfo("Execution aborted by signal");
          throw new DOMException("Aborted", "AbortError");
        }

        try {
          logDebug(`Attempt ${attempt + 1}/${config.maxRetries + 1}`);
          const result = await fn();

          // Success! Track if this was a retry
          if (attempt > 0) {
            this._stats.successfulRetries++;
            logInfo(`Request succeeded after ${attempt} retry(ies)`);
          }

          return result;
        } catch (error) {
          lastError = error;

          // Check if error is AbortError - don't retry aborts
          if (error.name === "AbortError") {
            logInfo("Request aborted, not retrying");
            throw error;
          }

          // Check if we should retry
          const canRetry = this.isRetryable(error);
          const hasRetriesLeft = attempt < config.maxRetries;

          if (!canRetry) {
            logDebug("Error is not retryable, failing immediately");
            if (attempt > 0) {
              this._stats.failedAfterRetries++;
            }
            throw error;
          }

          if (!hasRetriesLeft) {
            logWarn(`All ${config.maxRetries} retries exhausted`);
            this._stats.failedAfterRetries++;
            throw error;
          }

          // Calculate delay and wait
          const delay = this.calculateDelay(attempt);
          this._stats.totalRetries++;

          logInfo(`Retry ${attempt + 1}/${config.maxRetries} in ${delay}ms`, {
            error: error.message,
            status: error.status,
          });

          // Call onRetry callback if provided
          if (typeof config.onRetry === "function") {
            try {
              config.onRetry(attempt + 1, delay, error);
            } catch (callbackError) {
              logWarn("onRetry callback threw error:", callbackError);
            }
          }

          // Wait before retry (with abort check)
          await this._wait(delay, signal);
        }
      }

      // Should not reach here, but throw last error if we do
      throw lastError;
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
          if (signal) {
            signal.removeEventListener("abort", onAbort);
          }
          resolve();
        }, delay);

        // Set up abort listener
        const onAbort = () => {
          clearTimeout(timeoutId);
          reject(new DOMException("Aborted", "AbortError"));
        };

        if (signal) {
          signal.addEventListener("abort", onAbort, { once: true });
        }
      });
    }

    // ==========================================================================
    // STATISTICS
    // ==========================================================================

    /**
     * Get retry statistics
     *
     * @returns {Object} Statistics object
     * @property {number} totalRetries - Total retry attempts made
     * @property {number} successfulRetries - Retries that eventually succeeded
     * @property {number} failedAfterRetries - Requests that failed after all retries
     */
    getStats() {
      return { ...this._stats };
    }

    /**
     * Reset statistics
     */
    resetStats() {
      this._stats = {
        totalRetries: 0,
        successfulRetries: 0,
        failedAfterRetries: 0,
      };
      logDebug("Statistics reset");
    }
  }

  // ============================================================================
  // SINGLETON INSTANCE
  // ============================================================================

  const embedRetryHandler = new EmbedRetryHandler();

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  // Expose singleton instance
  window.EmbedRetryHandler = embedRetryHandler;

  // Also expose class for testing and custom instances
  window.EmbedRetryHandlerClass = EmbedRetryHandler;

  // ============================================================================
  // INITIALIZATION LOG
  // ============================================================================

  logInfo("OpenRouter Embed Retry Handler (Stage 6 Phase 1) loaded");
  logInfo("Available as: window.EmbedRetryHandler (singleton instance)");
  logInfo("Class available as: window.EmbedRetryHandlerClass");
})();
