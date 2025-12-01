/**
 * OpenRouter Embed API - Request Queue with Priority (Stage 6 Phase 7)
 *
 * Provides a priority-based request queue for managing multiple API requests,
 * preventing API overwhelming and enabling controlled batch processing.
 *
 * Features:
 * - Priority-based queue (CRITICAL, HIGH, NORMAL, LOW)
 * - Configurable concurrency limits
 * - Pause/resume queue processing
 * - Maximum queue size enforcement
 * - Queue change callbacks
 * - Statistics tracking
 * - Event emission for queue state changes
 *
 * @version 1.0.0 (Stage 6 Phase 7)
 * @date 01 December 2025
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
      console.error(`[EmbedQueue ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedQueue WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedQueue INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedQueue DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // PRIORITY LEVELS
  // ============================================================================

  /**
   * Priority levels for queue items
   * Lower number = higher priority (processed first)
   */
  const PRIORITY = {
    CRITICAL: 0, // Process immediately (e.g., user-initiated actions)
    HIGH: 1, // Process soon (e.g., visible content)
    NORMAL: 2, // Default priority
    LOW: 3, // Process when idle (e.g., prefetch)
  };

  // ============================================================================
  // DEFAULT CONFIGURATION
  // ============================================================================

  const DEFAULT_CONFIG = {
    enabled: false, // Disabled by default (opt-in)
    maxSize: 50, // Maximum queue size
    concurrency: 1, // Concurrent requests (1 = sequential)
    defaultPriority: "normal", // 'critical' | 'high' | 'normal' | 'low'
    onQueueChange: null, // Callback: (queueLength) => void
  };

  // ============================================================================
  // QUEUE STATUS CONSTANTS
  // ============================================================================

  const STATUS = {
    PENDING: "pending",
    PROCESSING: "processing",
    COMPLETED: "completed",
    FAILED: "failed",
    CANCELLED: "cancelled",
  };

  // ============================================================================
  // EMBED QUEUE CLASS
  // ============================================================================

  class EmbedQueue {
    /**
     * Create a new queue handler instance
     *
     * @param {Object} [options] - Configuration options
     */
    constructor(options = {}) {
      this._config = { ...DEFAULT_CONFIG, ...options };

      // Queue storage - Map for O(1) lookup by ID
      this._queue = new Map();

      // Processing state
      this._paused = false;
      this._processing = new Set(); // IDs currently being processed

      // Statistics
      this._stats = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      };

      // Event emitter reference (set by OpenRouterEmbed integration)
      this._emitEvent = null;

      // Request executor reference (set by OpenRouterEmbed integration)
      this._executeRequest = null;

      // Processing loop control
      this._processingLoopActive = false;

      logInfo("EmbedQueue initialised", {
        maxSize: this._config.maxSize,
        concurrency: this._config.concurrency,
        defaultPriority: this._config.defaultPriority,
      });
    }

    // ==========================================================================
    // CONFIGURATION
    // ==========================================================================

    /**
     * Configure queue behaviour
     *
     * @param {Object} options - Queue configuration
     * @param {boolean} [options.enabled] - Enable/disable queue
     * @param {number} [options.maxSize] - Maximum queue size
     * @param {number} [options.concurrency] - Max concurrent requests
     * @param {string} [options.defaultPriority] - Default priority level
     * @param {Function} [options.onQueueChange] - Queue change callback
     * @returns {EmbedQueue} For chaining
     *
     * @example
     * queue.configure({ maxSize: 100, concurrency: 3 });
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

    // ==========================================================================
    // QUEUE OPERATIONS
    // ==========================================================================

    /**
     * Add a request to the queue
     *
     * @param {Object} request - Request data
     * @param {string} [request.userPrompt] - User prompt
     * @param {string} [request.systemPrompt] - System prompt
     * @param {Object} [options={}] - Queue options
     * @param {string} [options.priority='normal'] - Priority level
     * @returns {Promise<Object>} Promise that resolves with response
     * @throws {Error} If queue is full or invalid priority
     *
     * @example
     * const response = await queue.enqueue({
     *   userPrompt: 'Hello'
     * }, { priority: 'high' });
     */
    enqueue(request, options = {}) {
      // Validate request
      if (!request || typeof request !== "object") {
        const error = new Error("Invalid request: must be an object");
        logError("enqueue failed:", error.message);
        return Promise.reject(error);
      }

      // Check queue size
      if (this._queue.size >= this._config.maxSize) {
        const error = new Error(
          `Queue is full (max: ${this._config.maxSize}). Try again later.`
        );
        error.code = "QUEUE_FULL";
        logWarn("enqueue failed: queue full", {
          current: this._queue.size,
          max: this._config.maxSize,
        });
        return Promise.reject(error);
      }

      // Resolve priority
      const priorityName = (
        options.priority ||
        this._config.defaultPriority ||
        "normal"
      ).toUpperCase();
      const priority = PRIORITY[priorityName];

      if (priority === undefined) {
        const error = new Error(
          `Invalid priority: ${options.priority}. Use: critical, high, normal, low`
        );
        logError("enqueue failed:", error.message);
        return Promise.reject(error);
      }

      // Generate unique ID
      const id = this._generateId();

      // Create queue item with promise resolution
      return new Promise((resolve, reject) => {
        const queueItem = {
          id,
          request: { ...request },
          priority,
          status: STATUS.PENDING,
          addedAt: new Date(),
          startedAt: null,
          completedAt: null,
          error: null,
          resolve,
          reject,
        };

        // Add to queue
        this._queue.set(id, queueItem);
        this._stats.pending++;

        // Calculate position
        const position = this._getQueuePosition(id);

        logDebug("Request enqueued", {
          id,
          priority: priorityName,
          position,
          queueSize: this._queue.size,
        });

        // Emit event
        this._emitQueueEvent("queueAdd", { id, priority, position });

        // Notify queue change
        this._notifyQueueChange();

        // Start processing if not paused
        if (!this._paused) {
          this._processQueue();
        }
      });
    }

    /**
     * Remove a request from the queue
     *
     * @param {string} id - Queue item ID
     * @param {string} [reason='cancelled'] - Reason for removal
     * @returns {boolean} True if item was removed
     *
     * @example
     * queue.dequeue('req_123456');
     */
    dequeue(id, reason = "cancelled") {
      if (!id || typeof id !== "string") {
        logWarn("dequeue called with invalid ID");
        return false;
      }

      const item = this._queue.get(id);
      if (!item) {
        logDebug(`Item '${id}' not found in queue`);
        return false;
      }

      // Can only remove pending items
      if (item.status !== STATUS.PENDING) {
        logWarn(`Cannot dequeue item '${id}': status is ${item.status}`);
        return false;
      }

      // Remove from queue
      this._queue.delete(id);
      this._stats.pending--;
      this._stats.cancelled++;

      // Update item status
      item.status = STATUS.CANCELLED;
      item.completedAt = new Date();

      // Reject the promise
      const error = new Error(`Request cancelled: ${reason}`);
      error.code = "CANCELLED";
      item.reject(error);

      logDebug("Request dequeued", { id, reason });

      // Emit event
      this._emitQueueEvent("queueRemove", { id, reason });

      // Notify queue change
      this._notifyQueueChange();

      return true;
    }

    /**
     * Get current queue length (pending items only)
     *
     * @returns {number} Number of pending items
     *
     * @example
     * console.log(`${queue.getLength()} items waiting`);
     */
    getLength() {
      return this._stats.pending;
    }

    /**
     * Get queue items for display (pending and processing)
     *
     * Returns a safe copy without internal promise references
     *
     * @returns {Array<Object>} Queue items sorted by priority
     *
     * @example
     * const items = queue.getItems();
     * items.forEach(item => console.log(item.id, item.priority));
     */
    getItems() {
      const items = [];

      for (const item of this._queue.values()) {
        if (
          item.status === STATUS.PENDING ||
          item.status === STATUS.PROCESSING
        ) {
          items.push({
            id: item.id,
            priority: item.priority,
            status: item.status,
            addedAt: item.addedAt,
            startedAt: item.startedAt,
            // Don't expose request details or promise functions
          });
        }
      }

      // Sort by priority (lower = higher priority), then by addedAt
      return items.sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return a.addedAt.getTime() - b.addedAt.getTime();
      });
    }

    /**
     * Clear all pending items from the queue
     *
     * @returns {number} Number of items cleared
     *
     * @example
     * const cleared = queue.clear();
     * console.log(`Cleared ${cleared} items`);
     */
    clear() {
      let clearedCount = 0;
      const idsToRemove = [];

      // Identify pending items
      for (const [id, item] of this._queue.entries()) {
        if (item.status === STATUS.PENDING) {
          idsToRemove.push(id);
        }
      }

      // Remove and reject each
      for (const id of idsToRemove) {
        const item = this._queue.get(id);
        if (item) {
          this._queue.delete(id);
          this._stats.pending--;
          this._stats.cancelled++;

          item.status = STATUS.CANCELLED;
          item.completedAt = new Date();

          const error = new Error("Queue cleared");
          error.code = "QUEUE_CLEARED";
          item.reject(error);

          clearedCount++;
        }
      }

      logInfo(`Queue cleared: ${clearedCount} items removed`);

      // Emit event
      this._emitQueueEvent("queueClear", { count: clearedCount });

      // Notify queue change
      if (clearedCount > 0) {
        this._notifyQueueChange();
      }

      return clearedCount;
    }

    // ==========================================================================
    // PAUSE/RESUME
    // ==========================================================================

    /**
     * Pause queue processing
     *
     * Currently processing items will complete, but no new items will start
     *
     * @returns {EmbedQueue} For chaining
     *
     * @example
     * queue.pause();
     */
    pause() {
      if (!this._paused) {
        this._paused = true;
        logInfo("Queue processing paused");
        this._emitQueueEvent("queuePause", {});
      }
      return this;
    }

    /**
     * Resume queue processing
     *
     * @returns {EmbedQueue} For chaining
     *
     * @example
     * queue.resume();
     */
    resume() {
      if (this._paused) {
        this._paused = false;
        logInfo("Queue processing resumed");
        this._emitQueueEvent("queueResume", {});

        // Restart processing
        this._processQueue();
      }
      return this;
    }

    /**
     * Check if queue is paused
     *
     * @returns {boolean} True if paused
     *
     * @example
     * if (queue.isPaused()) {
     *   console.log('Queue is paused');
     * }
     */
    isPaused() {
      return this._paused;
    }

    // ==========================================================================
    // STATISTICS
    // ==========================================================================

    /**
     * Get queue statistics
     *
     * @returns {Object} Statistics object
     * @property {number} pending - Items waiting to be processed
     * @property {number} processing - Items currently being processed
     * @property {number} completed - Successfully completed items
     * @property {number} failed - Failed items
     * @property {number} cancelled - Cancelled items
     *
     * @example
     * const stats = queue.getStats();
     * console.log('Pending:', stats.pending);
     * console.log('Completed:', stats.completed);
     */
    getStats() {
      return { ...this._stats };
    }

    /**
     * Reset statistics (does not affect queue contents)
     *
     * @returns {EmbedQueue} For chaining
     *
     * @example
     * queue.resetStats();
     */
    resetStats() {
      // Preserve current counts
      this._stats = {
        pending: this._stats.pending,
        processing: this._stats.processing,
        completed: 0,
        failed: 0,
        cancelled: 0,
      };
      logDebug("Statistics reset");
      return this;
    }

    // ==========================================================================
    // REQUEST EXECUTION
    // ==========================================================================

    /**
     * Set the request executor function
     *
     * This is called by OpenRouterEmbed to provide the actual request handler
     *
     * @param {Function} executor - Async function: (request) => Promise<response>
     *
     * @example
     * queue.setExecutor(async (request) => {
     *   return await openRouterClient.sendRequest(request);
     * });
     */
    setExecutor(executor) {
      if (typeof executor !== "function") {
        logWarn("setExecutor called with non-function");
        return;
      }
      this._executeRequest = executor;
      logDebug("Request executor set");
    }

    // ==========================================================================
    // CLEANUP
    // ==========================================================================

    /**
     * Clean up queue resources
     *
     * Clears all pending items and resets state
     *
     * @example
     * queue.cleanup();
     */
    cleanup() {
      // Clear all pending items
      this.clear();

      // Reset state
      this._paused = false;
      this._processingLoopActive = false;

      // Clear any remaining items (processing ones)
      for (const [id, item] of this._queue.entries()) {
        if (item.status === STATUS.PROCESSING) {
          // Let processing items finish naturally
          // but don't wait for them
        }
      }

      logInfo("EmbedQueue cleaned up");
    }

    // ==========================================================================
    // INTERNAL METHODS
    // ==========================================================================

    /**
     * Generate unique queue item ID
     *
     * @private
     * @returns {string} Unique ID
     */
    _generateId() {
      return `queue_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 11)}`;
    }

    /**
     * Get position of item in queue (for display)
     *
     * @private
     * @param {string} id - Item ID
     * @returns {number} Position (1-based)
     */
    _getQueuePosition(id) {
      const items = this.getItems();
      const index = items.findIndex((item) => item.id === id);
      return index >= 0 ? index + 1 : -1;
    }

    /**
     * Get next item to process
     *
     * Returns highest priority pending item
     *
     * @private
     * @returns {Object|null} Queue item or null
     */
    _getNextItem() {
      let nextItem = null;
      let lowestPriority = Infinity;
      let earliestTime = Infinity;

      for (const item of this._queue.values()) {
        if (item.status !== STATUS.PENDING) continue;

        // Lower priority number = higher priority
        if (
          item.priority < lowestPriority ||
          (item.priority === lowestPriority &&
            item.addedAt.getTime() < earliestTime)
        ) {
          nextItem = item;
          lowestPriority = item.priority;
          earliestTime = item.addedAt.getTime();
        }
      }

      return nextItem;
    }

    /**
     * Process queue items
     *
     * @private
     */
    async _processQueue() {
      // Prevent multiple processing loops
      if (this._processingLoopActive) {
        logDebug("Processing loop already active");
        return;
      }

      // Check if paused
      if (this._paused) {
        logDebug("Queue is paused, not processing");
        return;
      }

      // Check if executor is available
      if (!this._executeRequest) {
        logDebug("No executor set, cannot process queue");
        return;
      }

      this._processingLoopActive = true;
      logDebug("Starting queue processing loop");

      try {
        while (!this._paused && this._stats.pending > 0) {
          // Check concurrency limit
          if (this._processing.size >= this._config.concurrency) {
            logDebug("Concurrency limit reached, waiting...", {
              processing: this._processing.size,
              limit: this._config.concurrency,
            });
            // Wait a bit before checking again
            await this._sleep(100);
            continue;
          }

          // Get next item
          const item = this._getNextItem();
          if (!item) {
            break;
          }

          // Process item (don't await - allow concurrency)
          this._processItem(item);

          // Small delay to prevent tight loop
          await this._sleep(10);
        }
      } finally {
        this._processingLoopActive = false;
        logDebug("Queue processing loop ended");
      }
    }

    /**
     * Process a single queue item
     *
     * @private
     * @param {Object} item - Queue item
     */
    async _processItem(item) {
      const startTime = Date.now();

      // Update status
      item.status = STATUS.PROCESSING;
      item.startedAt = new Date();
      this._stats.pending--;
      this._stats.processing++;
      this._processing.add(item.id);

      logDebug("Processing item", { id: item.id, priority: item.priority });

      // Emit process event
      this._emitQueueEvent("queueProcess", {
        id: item.id,
        priority: item.priority,
      });

      // Notify queue change
      this._notifyQueueChange();

      try {
        // Execute the request
        const response = await this._executeRequest(item.request);

        // Success
        item.status = STATUS.COMPLETED;
        item.completedAt = new Date();
        this._stats.processing--;
        this._stats.completed++;
        this._processing.delete(item.id);

        const duration = Date.now() - startTime;
        logDebug("Item completed", { id: item.id, duration });

        // Emit complete event
        this._emitQueueEvent("queueComplete", {
          id: item.id,
          response,
          duration,
        });

        // Resolve the promise
        item.resolve(response);
      } catch (error) {
        // Failure
        item.status = STATUS.FAILED;
        item.completedAt = new Date();
        item.error = error;
        this._stats.processing--;
        this._stats.failed++;
        this._processing.delete(item.id);

        logError("Item failed", { id: item.id, error: error.message });

        // Emit error event
        this._emitQueueEvent("queueError", {
          id: item.id,
          error,
        });

        // Reject the promise
        item.reject(error);
      } finally {
        // Remove from queue map (keep for stats but don't hold reference)
        this._queue.delete(item.id);

        // Notify queue change
        this._notifyQueueChange();

        // Continue processing
        if (!this._paused && this._stats.pending > 0) {
          this._processQueue();
        }
      }
    }

    /**
     * Emit a queue event
     *
     * @private
     * @param {string} eventName - Event name
     * @param {Object} data - Event data
     */
    _emitQueueEvent(eventName, data) {
      if (typeof this._emitEvent === "function") {
        try {
          this._emitEvent(eventName, data);
        } catch (error) {
          logWarn(`Error emitting ${eventName} event:`, error);
        }
      }
    }

    /**
     * Notify queue change callback
     *
     * @private
     */
    _notifyQueueChange() {
      if (typeof this._config.onQueueChange === "function") {
        try {
          this._config.onQueueChange(this._stats.pending);
        } catch (error) {
          logWarn("onQueueChange callback error:", error);
        }
      }
    }

    /**
     * Sleep utility
     *
     * @private
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    _sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
  }

  // ============================================================================
  // ATTACH CONSTANTS AS STATIC PROPERTIES
  // ============================================================================

  EmbedQueue.PRIORITY = PRIORITY;
  EmbedQueue.STATUS = STATUS;

  // ============================================================================
  // SINGLETON INSTANCE
  // ============================================================================

  const embedQueue = new EmbedQueue();

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  // Expose singleton instance for convenience
  window.EmbedQueue = embedQueue;

  // Also expose class for testing and custom instances
  window.EmbedQueueClass = EmbedQueue;

  // ============================================================================
  // INITIALIZATION LOG
  // ============================================================================

  logInfo("OpenRouter Embed Queue (Stage 6 Phase 7) loaded");
  logInfo("Available as: window.EmbedQueue (singleton instance)");
  logInfo("Class available as: window.EmbedQueueClass");
  logInfo("Priority levels: CRITICAL (0), HIGH (1), NORMAL (2), LOW (3)");
})();
