/**
 * Memory Manager - Global Memory Monitoring and Resource Tracking
 *
 * Provides reusable utilities for preventing browser freezes caused by
 * memory leaks in canvas operations, image processing, and file handling.
 *
 * Features:
 * - Memory usage tracking with performance.memory API
 * - Resource lifecycle tracking (canvas, images, blobs)
 * - Circuit breaker pattern for operation protection
 * - Automatic cleanup and garbage collection hints
 *
 * @version 1.0.0
 * @date 25 November 2025
 */

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
    console.error(`[MemoryManager] ${message}`, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn(`[MemoryManager] ${message}`, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log(`[MemoryManager] ${message}`, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log(`[MemoryManager] ${message}`, ...args);
}

// ============================================================================
// MEMORY MONITOR
// ============================================================================

export const MemoryMonitor = {
  enabled: true,
  log: [],
  maxLogSize: 100,

  /**
   * Track an operation with memory information
   * @param {string} operation - Operation name
   * @param {Object} detail - Additional details
   */
  track(operation, detail = {}) {
    if (!this.enabled) return;

    const entry = {
      timestamp: Date.now(),
      operation,
      detail,
      memory: this.getMemoryInfo(),
    };

    this.log.push(entry);
    if (this.log.length > this.maxLogSize) {
      this.log.shift();
    }

    // Warn on high memory usage
    if (entry.memory.percentUsed > 80) {
      logWarn(
        `HIGH MEMORY USAGE (${entry.memory.percentUsed}%):`,
        operation,
        detail
      );
    }

    logDebug(`${operation}:`, entry.memory);
  },

  /**
   * Get current memory information
   * @returns {Object} Memory info object
   */
  getMemoryInfo() {
    if (performance.memory) {
      const mem = performance.memory;
      return {
        usedMB: (mem.usedJSHeapSize / 1024 / 1024).toFixed(2),
        totalMB: (mem.totalJSHeapSize / 1024 / 1024).toFixed(2),
        limitMB: (mem.jsHeapSizeLimit / 1024 / 1024).toFixed(2),
        percentUsed: ((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100).toFixed(
          2
        ),
      };
    }
    return { unavailable: true };
  },

  /**
   * Get formatted report of memory usage
   */
  getReport() {
    if (this.log.length === 0) {
      console.log("[MemoryMonitor] No tracking data available");
      return;
    }

    console.table(
      this.log.map((entry) => ({
        operation: entry.operation,
        usedMB: entry.memory.usedMB,
        percentUsed: entry.memory.percentUsed,
        ...entry.detail,
      }))
    );
  },

  /**
   * Get current memory status
   * @returns {Object} Current memory status
   */
  getStatus() {
    const info = this.getMemoryInfo();
    return {
      healthy: info.percentUsed < 80,
      warning: info.percentUsed >= 80 && info.percentUsed < 90,
      critical: info.percentUsed >= 90,
      info,
    };
  },

  /**
   * Reset the log
   */
  reset() {
    this.log = [];
    logInfo("Log reset");
  },

  /**
   * Enable tracking
   */
  enable() {
    this.enabled = true;
    logInfo("Tracking enabled");
  },

  /**
   * Disable tracking
   */
  disable() {
    this.enabled = false;
    logInfo("Tracking disabled");
  },
};

// ============================================================================
// RESOURCE TRACKER
// ============================================================================

export const ResourceTracker = {
  canvases: new Set(),
  images: new Set(),
  blobs: new Set(),
  readers: new Set(),

  /**
   * Track a resource
   * @param {string} type - Resource type: 'canvases', 'images', 'blobs', 'readers'
   * @param {Object} resource - The resource object
   * @param {string} id - Unique identifier
   */
  track(type, resource, id) {
    if (!this[type]) {
      logWarn(`Unknown resource type: ${type}`);
      return;
    }

    this[type].add({ resource, id, created: Date.now() });
    logDebug(`Tracked ${type}: ${id}`, `Total: ${this[type].size}`);
  },

  /**
   * Release a tracked resource
   * @param {string} type - Resource type
   * @param {string} id - Resource identifier
   */
  release(type, id) {
    if (!this[type]) {
      logWarn(`Unknown resource type: ${type}`);
      return;
    }

    const items = Array.from(this[type]);
    const item = items.find((i) => i.id === id);
    if (item) {
      this[type].delete(item);
      logDebug(`Released ${type}: ${id}`, `Remaining: ${this[type].size}`);
    }
  },

  /**
   * Get report of tracked resources
   * @returns {Object} Resource counts
   */
  getReport() {
    return {
      canvases: this.canvases.size,
      images: this.images.size,
      blobs: this.blobs.size,
      readers: this.readers.size,
      total:
        this.canvases.size +
        this.images.size +
        this.blobs.size +
        this.readers.size,
    };
  },

  /**
   * Force cleanup of all tracked resources
   */
  forceCleanup() {
    logWarn("Force cleanup initiated");

    // Clean up canvases
    this.canvases.forEach((item) => {
      if (item.resource) {
        try {
          item.resource.width = 0;
          item.resource.height = 0;
        } catch (e) {
          logDebug("Canvas cleanup failed:", e.message);
        }
      }
    });

    // Clean up images
    this.images.forEach((item) => {
      if (item.resource) {
        try {
          if (item.resource.src && item.resource.src.startsWith("blob:")) {
            URL.revokeObjectURL(item.resource.src);
          }
          item.resource.src = "";
          item.resource.onload = null;
          item.resource.onerror = null;
        } catch (e) {
          logDebug("Image cleanup failed:", e.message);
        }
      }
    });

    // Clean up blobs
    this.blobs.forEach((item) => {
      if (item.resource && typeof item.resource === "string") {
        try {
          URL.revokeObjectURL(item.resource);
        } catch (e) {
          logDebug("Blob cleanup failed:", e.message);
        }
      }
    });

    // Clean up file readers
    this.readers.forEach((item) => {
      if (item.resource) {
        try {
          item.resource.abort();
        } catch (e) {
          logDebug("Reader cleanup failed:", e.message);
        }
      }
    });

    this.canvases.clear();
    this.images.clear();
    this.blobs.clear();
    this.readers.clear();

    logInfo("Cleanup complete");

    // Suggest garbage collection (hint only)
    if (window.gc) {
      window.gc();
      logDebug("Garbage collection triggered");
    }
  },

  /**
   * Get resources older than specified age
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {Array} Old resources
   */
  getOldResources(maxAge = 60000) {
    const now = Date.now();
    const old = [];

    ["canvases", "images", "blobs", "readers"].forEach((type) => {
      this[type].forEach((item) => {
        if (now - item.created > maxAge) {
          old.push({ type, id: item.id, age: now - item.created });
        }
      });
    });

    return old;
  },

  /**
   * Clean up old resources
   * @param {number} maxAge - Maximum age in milliseconds
   */
  cleanupOldResources(maxAge = 60000) {
    const old = this.getOldResources(maxAge);

    if (old.length === 0) {
      logDebug("No old resources to cleanup");
      return;
    }

    logInfo(`Cleaning up ${old.length} old resources`);
    old.forEach((item) => {
      this.release(item.type, item.id);
    });
  },
};

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

export const CircuitBreaker = {
  state: "CLOSED", // CLOSED, OPEN, HALF_OPEN
  failureCount: 0,
  failureThreshold: 3,
  successCount: 0,
  successThreshold: 2,
  timeout: 60000, // 1 minute cooldown
  lastFailureTime: null,

  /**
   * Execute an operation with circuit breaker protection
   * @param {Function} operation - Async operation to execute
   * @param {string} operationName - Name for logging
   * @returns {Promise} Operation result
   */
  async execute(operation, operationName) {
    if (this.state === "OPEN") {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure < this.timeout) {
        const waitTime = Math.ceil((this.timeout - timeSinceFailure) / 1000);
        const error = new Error(
          `Circuit breaker OPEN for ${operationName}. Wait ${waitTime}s before retry.`
        );
        logWarn(error.message);
        throw error;
      } else {
        this.state = "HALF_OPEN";
        logInfo(`${operationName}: Attempting recovery (HALF_OPEN)`);
      }
    }

    try {
      const result = await operation();

      if (this.state === "HALF_OPEN") {
        this.successCount++;
        if (this.successCount >= this.successThreshold) {
          this.reset();
          logInfo(`${operationName}: Recovered (CLOSED)`);
        }
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      logError(
        `${operationName}: Failure ${this.failureCount}/${this.failureThreshold}`,
        error
      );

      if (this.failureCount >= this.failureThreshold) {
        this.state = "OPEN";
        logError(`${operationName}: CIRCUIT OPEN - Too many failures`);

        // Force cleanup on circuit open
        ResourceTracker.forceCleanup();
        MemoryMonitor.getReport();
      }

      throw error;
    }
  },

  /**
   * Reset the circuit breaker
   */
  reset() {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    logInfo("Circuit breaker reset to CLOSED");
  },

  /**
   * Manually open the circuit breaker
   */
  forceOpen() {
    this.state = "OPEN";
    this.lastFailureTime = Date.now();
    logWarn("Circuit breaker manually opened");
  },

  /**
   * Get current state
   * @returns {Object} Current state information
   */
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      timeSinceFailure: this.lastFailureTime
        ? Date.now() - this.lastFailureTime
        : null,
    };
  },
};

// ============================================================================
// HEALTH CHECK
// ============================================================================

export const MemoryHealth = {
  /**
   * Perform comprehensive health check
   * @returns {Object} Health check results
   */
  check() {
    const memory = MemoryMonitor.getStatus();
    const resources = ResourceTracker.getReport();
    const circuit = CircuitBreaker.getState();
    const oldResources = ResourceTracker.getOldResources();

    const issues = [];

    if (memory.critical) {
      issues.push("CRITICAL: Memory usage above 90%");
    } else if (memory.warning) {
      issues.push("WARNING: Memory usage above 80%");
    }

    if (resources.total > 10) {
      issues.push(`WARNING: High resource count (${resources.total})`);
    }

    if (oldResources.length > 0) {
      issues.push(`WARNING: ${oldResources.length} stale resources detected`);
    }

    if (circuit.state === "OPEN") {
      issues.push("CRITICAL: Circuit breaker is OPEN");
    }

    return {
      healthy: issues.length === 0,
      memory,
      resources,
      circuit,
      oldResources: oldResources.length,
      issues,
      recommendations: this.getRecommendations(issues),
    };
  },

  /**
   * Get recommendations based on issues
   * @param {Array} issues - Detected issues
   * @returns {Array} Recommendations
   */
  getRecommendations(issues) {
    const recommendations = [];

    if (issues.some((i) => i.includes("Memory usage"))) {
      recommendations.push("Run ResourceTracker.forceCleanup()");
      recommendations.push("Reduce concurrent operations");
    }

    if (issues.some((i) => i.includes("resource count"))) {
      recommendations.push("Run ResourceTracker.cleanupOldResources()");
    }

    if (issues.some((i) => i.includes("stale resources"))) {
      recommendations.push("Run ResourceTracker.cleanupOldResources()");
    }

    if (issues.some((i) => i.includes("Circuit breaker"))) {
      recommendations.push("Wait for circuit breaker timeout");
      recommendations.push("Investigate underlying failures");
    }

    return recommendations;
  },

  /**
   * Print health report to console
   */
  report() {
    const health = this.check();

    console.log("\n=== MEMORY HEALTH CHECK ===");
    console.log(
      `Status: ${health.healthy ? "✅ HEALTHY" : "⚠️ ISSUES DETECTED"}`
    );
    console.log("\nMemory:", health.memory.info);
    console.log("Resources:", health.resources);
    console.log("Circuit Breaker:", health.circuit.state);
    console.log("Old Resources:", health.oldResources);

    if (health.issues.length > 0) {
      console.log("\n⚠️ Issues:");
      health.issues.forEach((issue) => console.log(`  - ${issue}`));
    }

    if (health.recommendations.length > 0) {
      console.log("\n💡 Recommendations:");
      health.recommendations.forEach((rec) => console.log(`  - ${rec}`));
    }

    console.log("========================\n");

    return health;
  },
};

// ============================================================================
// GLOBAL EXPORTS
// ============================================================================

logInfo("Memory Manager utilities loaded");
