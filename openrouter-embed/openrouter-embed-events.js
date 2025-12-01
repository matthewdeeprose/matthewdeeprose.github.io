/**
 * OpenRouter Embed API - Event Emitter (Stage 6 Phase 2)
 *
 * Provides a publish-subscribe event system for lifecycle hooks,
 * enabling extension without core modification.
 *
 * Features:
 * - Subscribe/unsubscribe to events (on/off)
 * - One-time subscriptions (once)
 * - Event emission with data passing
 * - Handler isolation (errors don't break other handlers)
 * - Memory-safe cleanup (removeAllListeners)
 * - Statistics and introspection (listenerCount, eventNames)
 *
 * Standard Events (for integration):
 * - beforeRequest: { userPrompt, systemPrompt, model, options }
 * - afterRequest: { response, duration, model, cached }
 * - error: { error, retryable, attempt }
 * - retry: { attempt, delay, error }
 * - retrySuccess: { attempt, totalAttempts }
 * - retryExhausted: { attempts, lastError }
 * - progress: { stage, percent, message }
 * - streamChunk: { chunk, buffer, chunkIndex }
 * - streamComplete: { fullResponse, duration }
 * - cancel: { reason }
 * - fileAttached: { file, analysis, compressed }
 * - modelSelected: { model, reason, capabilities }
 *
 * @version 1.0.0 (Stage 6 Phase 2)
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
      console.error(`[EmbedEventEmitter ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedEventEmitter WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedEventEmitter INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedEventEmitter DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // EMBED EVENT EMITTER CLASS
  // ============================================================================

  class EmbedEventEmitter {
    /**
     * Create a new event emitter instance
     */
    constructor() {
      // Use Map for O(1) event lookup, Set for O(1) handler operations
      this._handlers = new Map();

      logInfo("EmbedEventEmitter initialised");
    }

    // ==========================================================================
    // SUBSCRIPTION METHODS
    // ==========================================================================

    /**
     * Subscribe to an event
     *
     * @param {string} event - Event name
     * @param {Function} handler - Event handler function
     * @returns {Function} Unsubscribe function
     * @throws {Error} If event or handler is invalid
     *
     * @example
     * const unsubscribe = emitter.on('beforeRequest', (data) => {
     *   console.log('Request starting:', data.userPrompt);
     * });
     * // Later: unsubscribe();
     */
    on(event, handler) {
      // Validate parameters
      if (typeof event !== "string" || !event.trim()) {
        throw new Error("Event name must be a non-empty string");
      }
      if (typeof handler !== "function") {
        throw new Error("Handler must be a function");
      }

      const eventName = event.trim();

      // Get or create handlers Set for this event
      if (!this._handlers.has(eventName)) {
        this._handlers.set(eventName, new Set());
      }

      const handlers = this._handlers.get(eventName);
      handlers.add(handler);

      logDebug(`Handler added for '${eventName}'`, {
        listenerCount: handlers.size,
      });

      // Return unsubscribe function
      return () => this.off(eventName, handler);
    }

    /**
     * Subscribe to an event (one-time only)
     *
     * Handler will be automatically removed after first invocation.
     *
     * @param {string} event - Event name
     * @param {Function} handler - Event handler function
     * @returns {Function} Unsubscribe function
     *
     * @example
     * emitter.once('streamComplete', (data) => {
     *   console.log('Stream finished:', data.fullResponse.length, 'chars');
     * });
     */
    once(event, handler) {
      // Validate parameters (on() will also validate, but better error message here)
      if (typeof handler !== "function") {
        throw new Error("Handler must be a function");
      }

      // Create wrapper that removes itself after first call
      const wrapper = (data) => {
        this.off(event, wrapper);
        handler(data);
      };

      // Store reference to original handler for debugging
      wrapper._originalHandler = handler;
      wrapper._isOnceWrapper = true;

      return this.on(event, wrapper);
    }

    /**
     * Unsubscribe from an event
     *
     * @param {string} event - Event name
     * @param {Function} handler - Handler to remove
     * @returns {boolean} True if handler was removed, false if not found
     *
     * @example
     * const handler = (data) => console.log(data);
     * emitter.on('error', handler);
     * emitter.off('error', handler); // Returns true
     */
    off(event, handler) {
      if (typeof event !== "string" || !event.trim()) {
        logWarn("off() called with invalid event name");
        return false;
      }

      const eventName = event.trim();
      const handlers = this._handlers.get(eventName);

      if (!handlers) {
        logDebug(`No handlers registered for '${eventName}'`);
        return false;
      }

      const removed = handlers.delete(handler);

      if (removed) {
        logDebug(`Handler removed for '${eventName}'`, {
          remainingListeners: handlers.size,
        });

        // Clean up empty handler sets
        if (handlers.size === 0) {
          this._handlers.delete(eventName);
        }
      }

      return removed;
    }

    // ==========================================================================
    // EMISSION METHODS
    // ==========================================================================

    /**
     * Emit an event
     *
     * Calls all registered handlers for the event with the provided data.
     * Errors in individual handlers are caught and logged but don't
     * prevent other handlers from being called.
     *
     * @param {string} event - Event name
     * @param {any} [data] - Event data to pass to handlers
     * @returns {boolean} True if any handlers were called
     *
     * @example
     * emitter.emit('beforeRequest', {
     *   userPrompt: 'Hello',
     *   model: 'claude-3'
     * });
     */
    emit(event, data) {
      if (typeof event !== "string" || !event.trim()) {
        logWarn("emit() called with invalid event name");
        return false;
      }

      const eventName = event.trim();
      const handlers = this._handlers.get(eventName);

      if (!handlers || handlers.size === 0) {
        logDebug(`No handlers for '${eventName}', nothing emitted`);
        return false;
      }

      logDebug(`Emitting '${eventName}' to ${handlers.size} handler(s)`);

      // Call each handler with error isolation
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          // Log error but continue to next handler
          logError(`Error in event handler for '${eventName}':`, error);
        }
      });

      return true;
    }

    // ==========================================================================
    // CLEANUP METHODS
    // ==========================================================================

    /**
     * Remove all listeners for an event (or all events)
     *
     * @param {string} [event] - Optional event name. If omitted, removes all listeners.
     *
     * @example
     * emitter.removeAllListeners('error'); // Remove error handlers only
     * emitter.removeAllListeners();        // Remove all handlers
     */
    removeAllListeners(event) {
      if (event !== undefined) {
        if (typeof event !== "string" || !event.trim()) {
          logWarn("removeAllListeners() called with invalid event name");
          return;
        }

        const eventName = event.trim();
        const hadHandlers = this._handlers.has(eventName);
        this._handlers.delete(eventName);

        if (hadHandlers) {
          logDebug(`All listeners removed for '${eventName}'`);
        }
      } else {
        const eventCount = this._handlers.size;
        this._handlers.clear();
        logDebug(`All listeners removed (${eventCount} events cleared)`);
      }
    }

    // ==========================================================================
    // INTROSPECTION METHODS
    // ==========================================================================

    /**
     * Get listener count for an event
     *
     * @param {string} event - Event name
     * @returns {number} Number of registered handlers
     *
     * @example
     * const count = emitter.listenerCount('error');
     * console.log(`${count} error handlers registered`);
     */
    listenerCount(event) {
      if (typeof event !== "string" || !event.trim()) {
        return 0;
      }

      const handlers = this._handlers.get(event.trim());
      return handlers ? handlers.size : 0;
    }

    /**
     * Get all registered event names
     *
     * @returns {string[]} Array of event names with at least one handler
     *
     * @example
     * const events = emitter.eventNames();
     * console.log('Active events:', events.join(', '));
     */
    eventNames() {
      return Array.from(this._handlers.keys());
    }

    /**
     * Check if an event has any listeners
     *
     * @param {string} event - Event name
     * @returns {boolean} True if event has at least one listener
     *
     * @example
     * if (emitter.hasListeners('error')) {
     *   emitter.emit('error', { message: 'Something went wrong' });
     * }
     */
    hasListeners(event) {
      return this.listenerCount(event) > 0;
    }
  }

  // ============================================================================
  // SINGLETON INSTANCE
  // ============================================================================

  const embedEventEmitter = new EmbedEventEmitter();

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  // Expose singleton instance for convenience
  window.EmbedEventEmitter = embedEventEmitter;

  // Also expose class for testing and custom instances
  window.EmbedEventEmitterClass = EmbedEventEmitter;

  // ============================================================================
  // INITIALIZATION LOG
  // ============================================================================

  logInfo("OpenRouter Embed Event Emitter (Stage 6 Phase 2) loaded");
  logInfo("Available as: window.EmbedEventEmitter (singleton instance)");
  logInfo("Class available as: window.EmbedEventEmitterClass");
})();
