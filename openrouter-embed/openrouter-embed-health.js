/**
 * OpenRouter Embed API - Health Monitor (Stage 6 Phase 8)
 *
 * Provides connection health monitoring for proactive connectivity feedback.
 * Monitors API availability and reports status changes to enable graceful
 * degradation and user notification.
 *
 * Features:
 * - Periodic health checks with configurable interval
 * - Status tracking: healthy, degraded, unhealthy, unknown
 * - Consecutive failure threshold for status transitions
 * - Latency measurement for performance monitoring
 * - Event emission for status changes
 * - Callback support for status notifications
 * - Memory-safe timer management
 *
 * @version 1.0.0 (Stage 6 Phase 8)
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
      console.error(`[EmbedHealthMonitor ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedHealthMonitor WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedHealthMonitor INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedHealthMonitor DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // HEALTH STATUS CONSTANTS
  // ============================================================================

  /**
   * Health status values
   */
  const HEALTH_STATUS = {
    HEALTHY: "healthy", // API responding normally
    DEGRADED: "degraded", // Some failures but not critical (1-2 consecutive)
    UNHEALTHY: "unhealthy", // Multiple consecutive failures
    UNKNOWN: "unknown", // No checks performed yet
  };

  // ============================================================================
  // DEFAULT CONFIGURATION
  // ============================================================================

  const DEFAULT_CONFIG = {
    enabled: false, // Disabled by default (opt-in)
    checkInterval: 30000, // Health check interval in ms (30 seconds)
    timeout: 5000, // Health check timeout in ms (5 seconds)
    unhealthyThreshold: 3, // Consecutive failures before unhealthy
    onStatusChange: null, // Callback: (status) => void
    endpoint: "https://openrouter.ai/api/v1/models", // Health check endpoint
  };

  // ============================================================================
  // EMBED HEALTH MONITOR CLASS
  // ============================================================================

  class EmbedHealthMonitor {
    /**
     * Create a new health monitor instance
     *
     * @param {Object} [options] - Configuration options
     */
    constructor(options = {}) {
      this._config = { ...DEFAULT_CONFIG, ...options };

      // Health state
      this._status = HEALTH_STATUS.UNKNOWN;
      this._latency = 0;
      this._lastCheck = null;
      this._consecutiveFailures = 0;
      this._lastError = null;

      // Timer management (memory-safe)
      this._checkIntervalId = null;
      this._timers = new Set();

      // Event emitter reference (set by OpenRouterEmbed)
      this._emitEvent = null;

      // Tracking for monitoring state
      this._isMonitoring = false;
      this._checkInProgress = false;

      logInfo("EmbedHealthMonitor initialised", {
        enabled: this._config.enabled,
        checkInterval: this._config.checkInterval,
        unhealthyThreshold: this._config.unhealthyThreshold,
      });
    }

    // ==========================================================================
    // STATIC PROPERTIES
    // ==========================================================================

    // DEFAULTS is attached as static property after class definition

    // STATUS is attached as static property after class definition

    // ==========================================================================
    // CONFIGURATION
    // ==========================================================================

    /**
     * Configure health monitoring
     *
     * @param {Object} options - Configuration options
     * @param {boolean} [options.enabled] - Enable monitoring
     * @param {number} [options.checkInterval] - Check interval (ms)
     * @param {number} [options.timeout] - Check timeout (ms)
     * @param {number} [options.unhealthyThreshold] - Failures before unhealthy
     * @param {Function} [options.onStatusChange] - Status change callback
     * @returns {EmbedHealthMonitor} For chaining
     */
    configure(options = {}) {
      if (options && typeof options === "object") {
        const previousEnabled = this._config.enabled;
        this._config = { ...this._config, ...options };

        // Handle enabled state change
        if (previousEnabled && !this._config.enabled) {
          this.stop();
        }

        // Update interval if changed whilst monitoring
        if (this._isMonitoring && options.checkInterval !== undefined) {
          this.stop();
          this.start();
        }

        logDebug("Configuration updated", {
          enabled: this._config.enabled,
          checkInterval: this._config.checkInterval,
        });
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
      this.stop();
      this._config = { ...DEFAULT_CONFIG };
      this._status = HEALTH_STATUS.UNKNOWN;
      this._latency = 0;
      this._lastCheck = null;
      this._consecutiveFailures = 0;
      this._lastError = null;
      logInfo("Configuration reset to defaults");
    }

    // ==========================================================================
    // MONITORING CONTROL
    // ==========================================================================

    /**
     * Start periodic health checks
     *
     * @returns {EmbedHealthMonitor} For chaining
     */
    start() {
      if (this._isMonitoring) {
        logDebug("Already monitoring, ignoring start()");
        return this;
      }

      if (!this._config.enabled) {
        logDebug("Health monitoring disabled, ignoring start()");
        return this;
      }

      this._isMonitoring = true;

      // Perform initial check immediately
      this.check().catch((error) => {
        logWarn("Initial health check failed:", error.message);
      });

      // Set up periodic checks
      this._checkIntervalId = setInterval(() => {
        if (!this._checkInProgress) {
          this.check().catch((error) => {
            logWarn("Periodic health check failed:", error.message);
          });
        }
      }, this._config.checkInterval);

      logInfo("Health monitoring started", {
        checkInterval: this._config.checkInterval,
      });

      return this;
    }

    /**
     * Stop periodic health checks
     *
     * @returns {EmbedHealthMonitor} For chaining
     */
    stop() {
      if (!this._isMonitoring && !this._checkIntervalId) {
        logDebug("Not monitoring, ignoring stop()");
        return this;
      }

      // Clear interval
      if (this._checkIntervalId) {
        clearInterval(this._checkIntervalId);
        this._checkIntervalId = null;
      }

      // Clear any pending timers
      this._timers.forEach((timerId) => clearTimeout(timerId));
      this._timers.clear();

      this._isMonitoring = false;

      logInfo("Health monitoring stopped");

      return this;
    }

    /**
     * Check if monitoring is active
     *
     * @returns {boolean} True if monitoring is active
     */
    isMonitoring() {
      return this._isMonitoring;
    }

    // ==========================================================================
    // HEALTH CHECK
    // ==========================================================================

    /**
     * Perform an immediate health check
     *
     * Makes a lightweight request to verify API connectivity and measures
     * latency. Updates internal status based on success/failure.
     *
     * @returns {Promise<Object>} Health status object
     */
    async check() {
      if (this._checkInProgress) {
        logDebug("Check already in progress, returning current status");
        return this.getStatus();
      }

      this._checkInProgress = true;
      const startTime = performance.now();

      try {
        logDebug("Performing health check...", {
          endpoint: this._config.endpoint,
        });

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, this._config.timeout);

        // Track timer for cleanup
        this._timers.add(timeoutId);

        try {
          const response = await fetch(this._config.endpoint, {
            method: "HEAD",
            signal: controller.signal,
            cache: "no-cache",
          });

          clearTimeout(timeoutId);
          this._timers.delete(timeoutId);

          const latency = Math.round(performance.now() - startTime);

          if (response.ok || response.status === 405) {
            // 405 Method Not Allowed is acceptable - endpoint exists
            return this._recordSuccess(latency);
          } else {
            return this._recordFailure(
              new Error(`HTTP ${response.status} ${response.statusText}`),
              latency
            );
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          this._timers.delete(timeoutId);
          throw fetchError;
        }
      } catch (error) {
        const latency = Math.round(performance.now() - startTime);

        // Handle abort specifically
        if (error.name === "AbortError") {
          return this._recordFailure(
            new Error("Health check timed out"),
            latency
          );
        }

        return this._recordFailure(error, latency);
      } finally {
        this._checkInProgress = false;
      }
    }

    /**
     * Record a successful health check
     *
     * @private
     * @param {number} latency - Check latency in ms
     * @returns {Object} Updated health status
     */
    _recordSuccess(latency) {
      const previousStatus = this._status;

      this._latency = latency;
      this._lastCheck = new Date();
      this._consecutiveFailures = 0;
      this._lastError = null;
      this._status = HEALTH_STATUS.HEALTHY;

      logDebug("Health check succeeded", {
        latency,
        previousStatus,
        newStatus: this._status,
      });

      // Emit healthCheck event
      this._emitHealthEvent("healthCheck", {
        status: this._status,
        latency,
      });

      // Handle status change
      if (previousStatus !== this._status) {
        this._handleStatusChange(previousStatus, this._status);
      }

      return this.getStatus();
    }

    /**
     * Record a failed health check
     *
     * @private
     * @param {Error} error - The error that occurred
     * @param {number} latency - Check latency in ms
     * @returns {Object} Updated health status
     */
    _recordFailure(error, latency) {
      const previousStatus = this._status;

      this._latency = latency;
      this._lastCheck = new Date();
      this._consecutiveFailures++;
      this._lastError = error;

      // Determine new status based on consecutive failures
      if (this._consecutiveFailures >= this._config.unhealthyThreshold) {
        this._status = HEALTH_STATUS.UNHEALTHY;
      } else if (this._consecutiveFailures > 0) {
        this._status = HEALTH_STATUS.DEGRADED;
      }

      logDebug("Health check failed", {
        error: error.message,
        latency,
        consecutiveFailures: this._consecutiveFailures,
        previousStatus,
        newStatus: this._status,
      });

      // Emit healthCheck event
      this._emitHealthEvent("healthCheck", {
        status: this._status,
        latency,
        error: error.message,
      });

      // Handle status change
      if (previousStatus !== this._status) {
        this._handleStatusChange(previousStatus, this._status);
      }

      return this.getStatus();
    }

    /**
     * Handle status change - emit event and call callback
     *
     * @private
     * @param {string} previousStatus - Previous status value
     * @param {string} newStatus - New status value
     */
    _handleStatusChange(previousStatus, newStatus) {
      logInfo("Health status changed", {
        previousStatus,
        newStatus,
        consecutiveFailures: this._consecutiveFailures,
      });

      const changeData = {
        previousStatus,
        newStatus,
        consecutiveFailures: this._consecutiveFailures,
        latency: this._latency,
        timestamp: this._lastCheck,
      };

      // Emit healthStatusChange event
      this._emitHealthEvent("healthStatusChange", changeData);

      // Call onStatusChange callback if provided
      if (typeof this._config.onStatusChange === "function") {
        try {
          this._config.onStatusChange(this.getStatus());
        } catch (callbackError) {
          logWarn("onStatusChange callback threw error:", callbackError);
        }
      }
    }

    /**
     * Emit a health event
     *
     * @private
     * @param {string} eventName - Event name
     * @param {Object} data - Event data
     */
    _emitHealthEvent(eventName, data) {
      if (typeof this._emitEvent === "function") {
        try {
          this._emitEvent(eventName, data);
        } catch (error) {
          logWarn(`Error emitting ${eventName} event:`, error);
        }
      }
    }

    // ==========================================================================
    // STATUS RETRIEVAL
    // ==========================================================================

    /**
     * Get current health status
     *
     * @returns {Object} Health status object
     * @property {string} status - Current status (healthy/degraded/unhealthy/unknown)
     * @property {number} latency - Last check latency in ms
     * @property {Date|null} lastCheck - Timestamp of last check
     * @property {number} consecutiveFailures - Current failure count
     * @property {Error|null} lastError - Last error if any
     */
    getStatus() {
      return {
        status: this._status,
        latency: this._latency,
        lastCheck: this._lastCheck,
        consecutiveFailures: this._consecutiveFailures,
        lastError: this._lastError,
      };
    }

    /**
     * Quick check if API is healthy
     *
     * @returns {boolean} True if status is healthy
     */
    isHealthy() {
      return this._status === HEALTH_STATUS.HEALTHY;
    }

    /**
     * Check if API is degraded (experiencing issues but not fully unhealthy)
     *
     * @returns {boolean} True if status is degraded
     */
    isDegraded() {
      return this._status === HEALTH_STATUS.DEGRADED;
    }

    /**
     * Check if API is unhealthy
     *
     * @returns {boolean} True if status is unhealthy
     */
    isUnhealthy() {
      return this._status === HEALTH_STATUS.UNHEALTHY;
    }

    /**
     * Check if status is unknown (no checks performed)
     *
     * @returns {boolean} True if status is unknown
     */
    isUnknown() {
      return this._status === HEALTH_STATUS.UNKNOWN;
    }

    // ==========================================================================
    // CLEANUP
    // ==========================================================================

    /**
     * Clean up all timers and resources
     *
     * Should be called when disposing of the health monitor.
     */
    cleanup() {
      this.stop();
      this._emitEvent = null;
      logInfo("Health monitor cleaned up");
    }

    // ==========================================================================
    // TESTING SUPPORT
    // ==========================================================================

    /**
     * Set custom endpoint for testing
     *
     * @param {string} endpoint - Custom endpoint URL
     * @returns {EmbedHealthMonitor} For chaining
     */
    setEndpoint(endpoint) {
      if (typeof endpoint === "string" && endpoint.trim()) {
        this._config.endpoint = endpoint.trim();
        logDebug("Endpoint updated", { endpoint: this._config.endpoint });
      }
      return this;
    }

    /**
     * Force a specific status (for testing only)
     *
     * @param {string} status - Status to set
     * @param {Object} [options] - Additional options
     * @param {number} [options.consecutiveFailures=0] - Failure count
     * @param {Error} [options.lastError=null] - Error to set
     * @returns {EmbedHealthMonitor} For chaining
     */
    _forceStatus(status, options = {}) {
      const previousStatus = this._status;

      if (Object.values(HEALTH_STATUS).includes(status)) {
        this._status = status;
        this._consecutiveFailures = options.consecutiveFailures || 0;
        this._lastError = options.lastError || null;
        this._lastCheck = new Date();

        if (previousStatus !== this._status) {
          this._handleStatusChange(previousStatus, this._status);
        }

        logDebug("Status forced", { status, options });
      } else {
        logWarn("Invalid status value:", status);
      }

      return this;
    }
  }

  // ============================================================================
  // ATTACH CONSTANTS AS STATIC PROPERTIES
  // ============================================================================

  // Define STATUS as a non-writable property to avoid conflicts
  Object.defineProperty(EmbedHealthMonitor, "STATUS", {
    value: HEALTH_STATUS,
    writable: false,
    enumerable: true,
    configurable: false,
  });

  // Also define DEFAULTS
  Object.defineProperty(EmbedHealthMonitor, "DEFAULTS", {
    value: { ...DEFAULT_CONFIG },
    writable: false,
    enumerable: true,
    configurable: false,
  });

  // ============================================================================
  // SINGLETON INSTANCE
  // ============================================================================

  const embedHealthMonitor = new EmbedHealthMonitor();

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  // Expose singleton instance for convenience
  window.EmbedHealthMonitor = embedHealthMonitor;

  // Also expose class for testing and custom instances
  window.EmbedHealthMonitorClass = EmbedHealthMonitor;

  // ============================================================================
  // INITIALIZATION LOG
  // ============================================================================

  logInfo("OpenRouter Embed Health Monitor (Stage 6 Phase 8) loaded");
  logInfo("Available as: window.EmbedHealthMonitor (singleton instance)");
  logInfo("Class available as: window.EmbedHealthMonitorClass");
  logInfo("Status values: healthy, degraded, unhealthy, unknown");
})();
