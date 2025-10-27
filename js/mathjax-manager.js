/**
 * MathJax Manager - Centralised MathJax Operations with Queue System
 *
 * Provides:
 * - Health monitoring and automatic recovery
 * - Serialised operations queue to prevent race conditions
 * - Reinitialization capability
 * - Enhanced error handling
 *
 * @module MathJaxManager
 */

// Logging configuration
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const DEFAULT_LOG_LEVEL = LOG_LEVELS.DEBUG;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR))
    console.error("[MathJax Manager]", message, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn("[MathJax Manager]", message, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log("[MathJax Manager]", message, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log("[MathJax Manager]", message, ...args);
}

/**
 * MathJax Manager Class
 */
class MathJaxManager {
  constructor() {
    this.operationsQueue = [];
    this.isProcessingQueue = false;
    this.healthCheckInterval = null;
    this.initializationAttempts = 0;
    this.maxInitAttempts = 3;
    this.lastHealthCheck = Date.now();
    this.healthCheckFrequency = 10000; // Check every 10 seconds
    this.isHealthy = false;
    this.initializationPromise = null;
  }

  /**
   * Initialize the MathJax Manager (lazy initialization)
   * @param {boolean} waitForMathJax - If true, wait for MathJax to be available
   */
  async initialize(waitForMathJax = false) {
    logInfo("Initialising MathJax Manager...", { waitForMathJax });

    // Check if already initialized successfully
    if (this.isHealthy) {
      logDebug("Already initialized and healthy");
      return true;
    }

    // If initialization in progress AND we're not demanding to wait, return existing promise
    if (this.initializationPromise && !waitForMathJax) {
      logDebug(
        "Initialization already in progress, returning existing promise"
      );
      return this.initializationPromise;
    }

    // Perform initialization
    this.initializationPromise = this._performInitialization(waitForMathJax);
    return this.initializationPromise;
  }

  /**
   * Internal initialization logic
   * @param {boolean} waitForMathJax - If true, wait indefinitely for MathJax
   */
  async _performInitialization(waitForMathJax = false) {
    try {
      // Quick check: Is MathJax already available?
      if (window.MathJax && window.MathJax.typesetPromise) {
        logInfo("MathJax already available, proceeding with initialization");
        const isHealthy = await this.checkHealth();

        if (isHealthy) {
          logInfo("✅ MathJax Manager initialised successfully");
          this.startHealthMonitoring();
          this.initializationAttempts = 0; // Reset attempts on success
          return true;
        }
      }

      // If not waiting for MathJax, return early (lazy mode)
      if (!waitForMathJax) {
        logInfo(
          "MathJax not yet available, deferring initialization until first use"
        );
        this.initializationPromise = null; // Allow re-initialization later
        return false; // Not an error, just not ready yet
      }

      // Wait for MathJax to be available (blocking mode)
      logInfo("Waiting for MathJax to become available...");
      await this._waitForMathJax(30000); // Increased timeout to 30 seconds

      // Verify MathJax health
      const isHealthy = await this.checkHealth();

      if (isHealthy) {
        logInfo("✅ MathJax Manager initialised successfully");
        this.startHealthMonitoring();
        this.initializationAttempts = 0; // Reset attempts on success
        return true;
      } else {
        throw new Error("MathJax health check failed after initialization");
      }
    } catch (error) {
      logError("Failed to initialise MathJax Manager:", error);
      this.initializationAttempts++;

      // Only retry if explicitly waiting for MathJax
      if (
        waitForMathJax &&
        this.initializationAttempts < this.maxInitAttempts
      ) {
        logWarn(
          `Retrying initialization (attempt ${
            this.initializationAttempts + 1
          }/${this.maxInitAttempts})...`
        );
        this.initializationPromise = null;
        await this._delay(2000 * this.initializationAttempts); // Exponential backoff
        return this.initialize(true); // Retry with waiting enabled
      } else {
        logWarn(
          "MathJax Manager initialization deferred - will initialize on first use"
        );
        this.initializationPromise = null;
        this.initializationAttempts = 0; // Reset for future attempts
        return false;
      }
    }
  }

  /**
   * Wait for MathJax to be available and fully configured
   * Coordinates with boilerplate.html MathJax setup
   */
  async _waitForMathJax(timeout = 30000) {
    const startTime = Date.now();

    logDebug("Waiting for MathJax to be ready...", {
      mathJaxExists: !!window.MathJax,
    });

    // Wait for MathJax to be available
    while (!window.MathJax || !window.MathJax.typesetPromise) {
      if (Date.now() - startTime > timeout) {
        logWarn("MathJax wait timeout details:", {
          mathJaxExists: !!window.MathJax,
          hasTypesetPromise: !!(
            window.MathJax && window.MathJax.typesetPromise
          ),
          elapsed: Date.now() - startTime,
        });
        throw new Error("MathJax load timeout exceeded");
      }

      await this._delay(100);
    }

    // Wait for MathJaxEnhancementReady flag from boilerplate.html
    // This ensures MathJax has completed its startup sequence
    const enhancementWaitStart = Date.now();
    while (!window.MathJaxEnhancementReady) {
      if (Date.now() - enhancementWaitStart > 5000) {
        logWarn("MathJaxEnhancementReady timeout, proceeding anyway");
        break;
      }
      await this._delay(100);
    }

    // Extended stabilization wait to prevent replaceChild errors
    await this._delay(1000);

    logInfo("✅ MathJax fully ready and stabilised", {
      mathJaxVersion: window.MathJax.version || "unknown",
      enhancementReady: !!window.MathJaxEnhancementReady,
      elapsed: Date.now() - startTime,
    });
  }

  /**
   * Check MathJax health status
   */
  async checkHealth() {
    try {
      // Check basic availability
      if (!window.MathJax || !window.MathJax.typesetPromise) {
        this.isHealthy = false;
        logWarn("MathJax not available");
        return false;
      }

      // Don't run health checks too soon after initialization
      if (!window.MathJaxEnhancementReady) {
        logWarn("Skipping health check - MathJax not fully ready yet");
        return false;
      }

      // Try a minimal typesetting operation
      const testElement = document.createElement("div");
      testElement.style.position = "absolute";
      testElement.style.left = "-9999px";
      testElement.style.visibility = "hidden";
      testElement.innerHTML = "\\(x = 1\\)";
      document.body.appendChild(testElement);

      try {
        // Use longer timeout for health checks
        await Promise.race([
          window.MathJax.typesetPromise([testElement]),
          this._timeout(5000, "Health check timeout"),
        ]);

        // Verify the element still exists before removing
        if (document.body.contains(testElement)) {
          document.body.removeChild(testElement);
        }

        this.isHealthy = true;
        this.lastHealthCheck = Date.now();
        this.consecutiveFailures = 0; // Reset failure counter
        logDebug("✅ MathJax health check passed");
        return true;
      } catch (error) {
        // Safe cleanup
        if (document.body.contains(testElement)) {
          document.body.removeChild(testElement);
        }
        throw error;
      }
    } catch (error) {
      this.isHealthy = false;

      // Track consecutive failures
      this.consecutiveFailures = (this.consecutiveFailures || 0) + 1;

      logError("❌ MathJax health check failed:", error);
      logWarn(`Consecutive failures: ${this.consecutiveFailures}`);

      // Nuclear option: After 5 consecutive failures, disable MathJax rendering
      if (this.consecutiveFailures >= 5) {
        logError("🚨 CRITICAL: MathJax has failed 5 consecutive health checks");
        logError("🚨 Disabling MathJax to prevent infinite error loops");

        // Set flag to prevent further rendering attempts
        window.MathJaxDisabled = true;
        this.stopHealthMonitoring();

        // Show user-friendly message
        this._showMathJaxDisabledWarning();
      }

      return false;
    }
  }

  /**
   * Show warning when MathJax is disabled due to repeated failures
   */
  _showMathJaxDisabledWarning() {
    const statusDiv = document.getElementById("mathjax-status");
    if (statusDiv) {
      statusDiv.textContent =
        "MathJax disabled due to errors - mathematical content may not render correctly";
      statusDiv.style.display = "block";
      statusDiv.style.background = "#00131D";
      statusDiv.style.background = "E1E8EC";

      // Add reload button
      const reloadBtn = document.createElement("button");
      reloadBtn.textContent = "Reload Page";
      reloadBtn.style.marginLeft = "10px";
      reloadBtn.style.padding = "4px 8px";
      reloadBtn.style.cursor = "pointer";
      reloadBtn.onclick = () => window.location.reload();
      statusDiv.appendChild(reloadBtn);
    }
  }

  /**
   * Start periodic health monitoring
   */
  startHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      const timeSinceLastCheck = Date.now() - this.lastHealthCheck;

      // Only check if enough time has passed and we're not processing queue
      if (
        timeSinceLastCheck >= this.healthCheckFrequency &&
        !this.isProcessingQueue
      ) {
        logDebug("Running periodic health check...");
        const isHealthy = await this.checkHealth();

        if (!isHealthy) {
          logWarn("Health check failed, attempting recovery...");
          await this.reinitialize();
        }
      }
    }, this.healthCheckFrequency);

    logInfo("Health monitoring started");
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logInfo("Health monitoring stopped");
    }
  }

  /**
   * Reinitialize MathJax
   */
  async reinitialize() {
    logWarn("🔄 Attempting to reinitialise MathJax...");

    try {
      // Stop health monitoring during reinitialization
      this.stopHealthMonitoring();

      // Clear the operations queue
      this.operationsQueue = [];
      this.isProcessingQueue = false;

      // Reset initialization state
      this.initializationPromise = null;
      this.initializationAttempts = 0;

      // Force MathJax to reset if possible
      if (window.MathJax && window.MathJax.startup) {
        try {
          // Clear MathJax's internal state
          if (window.MathJax.startup.document) {
            await window.MathJax.startup.document.clear();
            await window.MathJax.startup.document.updateDocument();
          }
        } catch (error) {
          logWarn("Could not clear MathJax document state:", error);
        }
      }

      // Wait a bit for cleanup
      await this._delay(1000);

      // Reinitialize
      const success = await this.initialize();

      if (success) {
        logInfo("✅ MathJax reinitialised successfully");
        return true;
      } else {
        logError("❌ MathJax reinitialization failed");
        return false;
      }
    } catch (error) {
      logError("Error during MathJax reinitialization:", error);
      return false;
    }
  }

  /**
   * Queue a MathJax typesetting operation
   * Auto-initializes manager if needed
   *
   * @param {HTMLElement|HTMLElement[]} elements - Element(s) to typeset
   * @param {Object} options - Operation options
   * @returns {Promise} Promise that resolves when operation completes
   */
  async queueTypeset(elements, options = {}) {
    // Ensure manager is initialized before queuing operations
    if (!this.isHealthy && !this.initializationPromise) {
      logInfo("Manager not initialized, attempting lazy initialization...");
      await this.initialize(true); // Wait for MathJax this time
    }

    return new Promise((resolve, reject) => {
      const operation = {
        type: "typeset",
        elements: Array.isArray(elements) ? elements : [elements],
        options,
        resolve,
        reject,
        timestamp: Date.now(),
        id: this._generateOperationId(),
      };

      this.operationsQueue.push(operation);
      logDebug(`Operation queued: ${operation.id}`, {
        queueLength: this.operationsQueue.length,
      });

      // Start processing if not already running
      if (!this.isProcessingQueue) {
        this._processQueue();
      }
    });
  }

  /**
   * Process the operations queue
   */
  async _processQueue() {
    if (this.isProcessingQueue) {
      logDebug("Queue processing already in progress");
      return;
    }

    if (this.operationsQueue.length === 0) {
      logDebug("Queue is empty");
      return;
    }

    this.isProcessingQueue = true;
    logDebug(
      `📋 Processing queue (${this.operationsQueue.length} operations)...`
    );

    while (this.operationsQueue.length > 0) {
      const operation = this.operationsQueue.shift();

      try {
        logDebug(`Processing operation: ${operation.id}`);

        // Check health before processing
        if (!this.isHealthy) {
          logWarn("MathJax unhealthy, checking health before operation...");
          const isHealthy = await this.checkHealth();

          if (!isHealthy) {
            throw new Error("MathJax is not healthy, aborting operation");
          }
        }

        // Filter out elements that don't exist in DOM
        const validElements = operation.elements.filter((el) => {
          if (!el || !document.body.contains(el)) {
            logWarn(`Element not in DOM, skipping: ${operation.id}`);
            return false;
          }
          return true;
        });

        if (validElements.length === 0) {
          logWarn(`No valid elements for operation: ${operation.id}`);
          operation.resolve();
          continue;
        }

        // Use unwrapped typesetPromise if available to ensure proper menu registration
        // The wrapper in boilerplate.html adds visual enhancements but bypasses
        // MathJax's menu event handler registration (contextmenu, click, keydown)
        // Using the unwrapped version allows MathJax to properly attach all handlers
        const typesetFunction =
          window.originalTypesetPromise || window.MathJax.typesetPromise;

        if (window.originalTypesetPromise) {
          logDebug(
            `Using unwrapped typesetPromise for proper menu registration`
          );
        } else {
          logWarn(
            `originalTypesetPromise not available, using wrapped version (menus may not work)`
          );
        }

        // Execute the typesetting operation with timeout
        await Promise.race([
          typesetFunction.call(window.MathJax, validElements),
          this._timeout(10000, "Typesetting operation timeout"),
        ]);

        // Note: When using unwrapped version, wrapper enhancements are bypassed
        // This is intentional to ensure menu handlers are properly registered
        logDebug(`✅ Typesetting completed for operation (${operation.id})`);

        logDebug(`✅ Operation completed: ${operation.id}`);
        operation.resolve();

        // Small delay between operations to prevent overwhelming MathJax
        await this._delay(50);
      } catch (error) {
        logError(`❌ Operation failed: ${operation.id}`, error);

        // Check if this is a critical error requiring reinitialization
        if (this._isCriticalError(error)) {
          logWarn("Critical error detected, triggering reinitialization...");
          operation.reject(error);

          // Clear remaining queue and reinitialize
          this.operationsQueue.forEach((op) =>
            op.reject(new Error("Queue cleared due to critical error"))
          );
          this.operationsQueue = [];

          this.isProcessingQueue = false;
          await this.reinitialize();
          return;
        }

        operation.reject(error);
      }
    }

    this.isProcessingQueue = false;
    logDebug("✅ Queue processing completed");
  }

  /**
   * Check if an error is critical and requires reinitialization
   */
  _isCriticalError(error) {
    const criticalPatterns = [
      /replaceChild/i,
      /null is not an object/i,
      /cannot read propert/i,
      /mathjax.*not.*defined/i,
    ];

    const errorString = error.toString();
    return criticalPatterns.some((pattern) => pattern.test(errorString));
  }

  /**
   * Generate a unique operation ID
   */
  _generateOperationId() {
    return `mjop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Utility: Create a timeout promise
   */
  _timeout(ms, message = "Operation timeout") {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  /**
   * Utility: Delay helper
   */
  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get manager status for debugging
   */
  getStatus() {
    return {
      isHealthy: this.isHealthy,
      queueLength: this.operationsQueue.length,
      isProcessingQueue: this.isProcessingQueue,
      initializationAttempts: this.initializationAttempts,
      lastHealthCheck: new Date(this.lastHealthCheck).toISOString(),
      healthCheckInterval: this.healthCheckInterval ? "Active" : "Inactive",
    };
  }

  /**
   * Force a health check (for debugging)
   */
  async forceHealthCheck() {
    logInfo("🔍 Forcing health check...");
    return await this.checkHealth();
  }

  /**
   * Clear the operations queue (for debugging/emergency)
   */
  clearQueue() {
    const cleared = this.operationsQueue.length;
    this.operationsQueue.forEach((op) =>
      op.reject(new Error("Queue manually cleared"))
    );
    this.operationsQueue = [];
    logWarn(`🗑️ Cleared ${cleared} operations from queue`);
    return cleared;
  }
}

// Create singleton instance
const mathJaxManager = new MathJaxManager();

// Export for global access
export { mathJaxManager, MathJaxManager };

// Global exposure for debugging
if (typeof window !== "undefined") {
  window.mathJaxManager = mathJaxManager;
  window.MathJaxManager = MathJaxManager;

  logInfo("MathJax Manager available globally");
  logInfo("Use window.mathJaxManager.getStatus() to check status");
  logInfo("Use window.mathJaxManager.forceHealthCheck() to test health");
  logInfo("Use window.mathJaxManager.reinitialize() to force reinit");
}
