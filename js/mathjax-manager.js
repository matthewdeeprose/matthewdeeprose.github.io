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

const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

// Notification configuration
// Set to true to show user-facing notifications (e.g., MathJax disabled warnings)
const SHOW_USER_NOTIFICATIONS = false;

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

    // Recovery subscription system for MMD Preview integration
    this.recoveryCallbacks = new Set();
    this.pendingElements = new Set(); // Track elements that need re-rendering on recovery
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
        "Initialization already in progress, returning existing promise",
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

        // CRITICAL: Wait for DOM to stabilize before health check
        // This prevents DOM corruption from premature health checks
        await this._waitForDOMStability();

        // NEW: If startup wasn't clean, clear stale references first
        if (window.MathJaxStartupClean === false) {
          logWarn(
            "Startup was not clean, clearing stale MathJax references...",
          );
          await this._clearStaleReferences();
        }

        const isHealthy = await this.checkHealth();

        if (isHealthy) {
          logInfo("✅ MathJax Manager initialised successfully");
          this.startHealthMonitoring();
          this.initializationAttempts = 0; // Reset attempts on success

          // NEW: Notify recovery subscribers on first successful init
          // This allows pending elements to be re-rendered
          if (
            this.pendingElements.size > 0 ||
            this.recoveryCallbacks.size > 0
          ) {
            logInfo(
              "🔄 First successful init - notifying recovery subscribers...",
            );
            this._notifyRecoverySubscribers();
          }

          return true;
        }
      }

      // If not waiting for MathJax, return early (lazy mode)
      if (!waitForMathJax) {
        logInfo(
          "MathJax not yet available, deferring initialization until first use",
        );
        this.initializationPromise = null; // Allow re-initialization later
        return false; // Not an error, just not ready yet
      }

      // Wait for MathJax to be available (blocking mode)
      logInfo("Waiting for MathJax to become available...");
      await this._waitForMathJax(30000); // Increased timeout to 30 seconds

      // Wait for DOM stability before health check
      await this._waitForDOMStability();

      // NEW: If startup wasn't clean, clear stale references and wait longer
      if (window.MathJaxStartupClean === false) {
        logWarn(
          "Startup was not clean, clearing stale references and waiting longer...",
        );
        await this._clearStaleReferences();
        await this._delay(1000); // Extra delay for recovery
      }

      // Verify MathJax health
      const isHealthy = await this.checkHealth();

      if (isHealthy) {
        logInfo("✅ MathJax Manager initialised successfully");
        this.startHealthMonitoring();
        this.initializationAttempts = 0; // Reset attempts on success

        // NEW: Notify recovery subscribers on first successful init
        if (this.pendingElements.size > 0 || this.recoveryCallbacks.size > 0) {
          logInfo(
            "🔄 First successful init - notifying recovery subscribers...",
          );
          this._notifyRecoverySubscribers();
        }

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
          }/${this.maxInitAttempts})...`,
        );
        this.initializationPromise = null;
        await this._delay(2000 * this.initializationAttempts); // Exponential backoff
        return this.initialize(true); // Retry with waiting enabled
      } else {
        logWarn(
          "MathJax Manager initialization deferred - will initialize on first use",
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
   * Wait for DOM to be stable before running health checks
   * This prevents replaceChild errors from premature health checks
   * @private
   * @returns {Promise<void>}
   */
  async _waitForDOMStability() {
    logDebug("Waiting for DOM stability before health check...");

    // Wait for document ready state
    if (document.readyState !== "complete") {
      await new Promise((resolve) => {
        if (document.readyState === "complete") {
          resolve();
        } else {
          window.addEventListener("load", resolve, { once: true });
        }
      });
    }

    // Additional grace period for MathJax to settle its internal state
    await this._delay(500);

    logDebug("DOM stability achieved, proceeding with health check");
  }

  /**
   * Clear stale element references from MathJax's internal tracking
   * This prevents replaceChild errors caused by orphaned DOM references
   * @private
   * @returns {Promise<void>}
   */
  async _clearStaleReferences() {
    logDebug("Clearing stale MathJax element references...");

    try {
      const mathDoc = window.MathJax?.startup?.document;
      if (!mathDoc) {
        logDebug("No MathJax document to clear");
        return;
      }

      // Clear the document's processed math list
      // Note: mathDoc.math.list may be a LinkedList, not an array
      if (mathDoc.math) {
        const mathList = mathDoc.math;

        // Try toArray() method first (LinkedList)
        if (typeof mathList.toArray === "function") {
          const items = mathList.toArray();
          const originalCount = items.length;
          let removedCount = 0;

          // Remove items whose nodes are no longer in DOM
          items.forEach((item) => {
            const node = item?.start?.node;
            if (node && !document.body.contains(node)) {
              try {
                mathList.remove(item);
                removedCount++;
              } catch (e) {
                // Ignore removal errors
              }
            }
          });

          if (removedCount > 0) {
            logInfo(`Cleared ${removedCount} stale math element references`);
          }
        } else if (mathList.list && Array.isArray(mathList.list)) {
          // Fallback: Direct array access
          const originalCount = mathList.list.length;
          mathList.list = mathList.list.filter((item) => {
            const node = item?.start?.node;
            return node && document.body.contains(node);
          });
          const removedCount = originalCount - mathList.list.length;

          if (removedCount > 0) {
            logInfo(`Cleared ${removedCount} stale math element references`);
          }
        } else {
          // Can't iterate - just log and continue
          logDebug(
            "Math list structure not iterable, skipping element cleanup",
          );
        }
      }

      // Clear any pending updates
      if (mathDoc.clear && typeof mathDoc.clear === "function") {
        try {
          await mathDoc.clear();
          logDebug("Cleared MathJax document state");
        } catch (clearError) {
          logWarn("Could not clear MathJax document:", clearError.message);
        }
      }

      // Small delay for state to settle
      await this._delay(100);

      logDebug("✅ Stale reference cleanup complete");
    } catch (error) {
      logWarn("Error during stale reference cleanup:", error.message);
      // Non-fatal - continue anyway
    }
  }

  /**
   * Scan the DOM for orphaned fallback elements and attempt to render them
   * This catches elements that failed during MathJax downtime
   * @private
   */
  async _scanAndRenderFallbacks() {
    if (!this.isHealthy) {
      logDebug("Skipping fallback scan - not healthy");
      return;
    }

    // Find elements with fallback classes that need rendering
    const fallbackSelectors = [
      ".mathjax-fallback",
      ".latex-fallback",
      "pre.latex-fallback",
    ];

    const fallbackElements = document.querySelectorAll(
      fallbackSelectors.join(", "),
    );

    if (fallbackElements.length === 0) {
      logDebug("No fallback elements found to recover");
      return;
    }

    logInfo(`🔍 Found ${fallbackElements.length} fallback elements to recover`);

    for (const element of fallbackElements) {
      try {
        // Skip if element is no longer in DOM
        if (!document.body.contains(element)) {
          continue;
        }

        // Get the parent container that should be rendered
        const container =
          element.closest(
            ".mathpix-rendered-output, .math-content, [data-math-content]",
          ) || element.parentElement;

        if (!container) {
          continue;
        }

        // Extract LaTeX content
        const latexContent = element.textContent?.trim();
        if (!latexContent) {
          continue;
        }

        logDebug("Attempting to recover fallback element", {
          content: latexContent.substring(0, 50) + "...",
          containerId: container.id || "anonymous",
        });

        // Replace fallback with raw content for MathJax
        container.innerHTML = latexContent;
        container.classList.remove("mathjax-fallback");

        // Queue for rendering
        await this.queueTypeset(container);

        logInfo("✅ Recovered fallback element successfully");
      } catch (error) {
        logWarn("Failed to recover fallback element:", error.message);
        // Continue with other elements
      }
    }
  }

  /**
   * Check MathJax health status (non-invasive passive check)
   * This version checks API availability without DOM manipulation
   * to prevent replaceChild errors
   */
  async checkHealth() {
    try {
      // Phase 1: Check basic availability
      if (!window.MathJax || !window.MathJax.typesetPromise) {
        this.isHealthy = false;
        logWarn("MathJax not available");
        return false;
      }

      // Phase 2: Don't run health checks too soon after initialization
      if (!window.MathJaxEnhancementReady) {
        logWarn("Skipping health check - MathJax not fully ready yet");
        return false;
      }

      // Phase 3: Passive API availability check (no DOM manipulation)
      // Check that critical MathJax APIs exist and are functions
      const hasTypesetPromise =
        typeof window.MathJax.typesetPromise === "function";
      const hasStartup = !!window.MathJax.startup;
      const hasDocument = !!window.MathJax.startup?.document;
      const hasVersion = !!window.MathJax.version;

      if (!hasTypesetPromise || !hasStartup || !hasDocument) {
        this.isHealthy = false;
        logWarn("MathJax APIs incomplete", {
          hasTypesetPromise,
          hasStartup,
          hasDocument,
          hasVersion,
        });

        // Track consecutive failures
        this.consecutiveFailures = (this.consecutiveFailures || 0) + 1;
        logWarn(`Consecutive API check failures: ${this.consecutiveFailures}`);

        return false;
      }

      // Phase 4: Check if MathJax has successfully processed any content on the page
      // This is a passive check that doesn't create new elements
      const hasProcessedContent =
        document.querySelector("mjx-container, .MathJax") !== null;

      // Success - all APIs available
      this.isHealthy = true;
      this.lastHealthCheck = Date.now();
      this.consecutiveFailures = 0; // Reset failure counter

      logDebug("✅ MathJax passive health check passed", {
        version: window.MathJax.version || "unknown",
        hasProcessedContent,
        apis: { hasTypesetPromise, hasStartup, hasDocument },
      });

      return true;
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
   * Respects SHOW_USER_NOTIFICATIONS configuration
   */
  _showMathJaxDisabledWarning() {
    // Always log to console for debugging purposes
    logError(
      "🚨 CRITICAL: MathJax disabled due to repeated failures. Please reload the page.",
    );

    // Only show user-facing notification if enabled
    if (!SHOW_USER_NOTIFICATIONS) {
      logDebug("User notifications disabled, skipping visual warning");
      return;
    }

    // Use UniversalNotifications for critical error display
    if (typeof UniversalNotifications !== "undefined") {
      UniversalNotifications.show(
        "MathJax disabled due to repeated errors. Mathematical content may not render correctly. Please reload the page to restore functionality.",
        "error",
        {
          duration: 0, // No auto-dismiss for critical errors
          dismissible: true,
        },
      );

      logInfo(
        "MathJax disabled warning shown via UniversalNotifications system",
      );
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
        const wasHealthy = this.isHealthy;
        const isHealthy = await this.checkHealth();

        if (!isHealthy) {
          logWarn("Health check failed, attempting recovery...");
          await this.reinitialize();
        } else if (!wasHealthy && isHealthy) {
          // NEW: Transitioned from unhealthy to healthy - notify subscribers
          logInfo("🔄 Health restored - notifying recovery subscribers...");
          this._notifyRecoverySubscribers();

          // Also scan for any orphaned fallback elements
          this._scanAndRenderFallbacks();
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

        // Notify subscribers about recovery
        this._notifyRecoverySubscribers();

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
      `📋 Processing queue (${this.operationsQueue.length} operations)...`,
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
            `Using unwrapped typesetPromise for proper menu registration`,
          );
        } else {
          logWarn(
            `originalTypesetPromise not available, using wrapped version (menus may not work)`,
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
            op.reject(new Error("Queue cleared due to critical error")),
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
      recoverySubscribers: this.recoveryCallbacks.size,
      pendingElements: this.pendingElements.size,
    };
  }

  // ============================================================================
  // Recovery Subscription System for MMD Preview Integration
  // ============================================================================

  /**
   * Subscribe to MathJax recovery events
   * Callback receives { healthy: boolean, timestamp: number }
   * @param {Function} callback - Function to call on recovery
   * @returns {Function} Unsubscribe function
   */
  onRecovery(callback) {
    if (typeof callback !== "function") {
      logWarn("onRecovery requires a function callback");
      return () => {};
    }

    this.recoveryCallbacks.add(callback);
    logDebug(
      `Recovery callback registered (total: ${this.recoveryCallbacks.size})`,
    );

    // Return unsubscribe function
    return () => {
      this.recoveryCallbacks.delete(callback);
      logDebug(
        `Recovery callback unregistered (remaining: ${this.recoveryCallbacks.size})`,
      );
    };
  }

  /**
   * Notify all recovery subscribers
   * @private
   */
  _notifyRecoverySubscribers() {
    if (this.recoveryCallbacks.size === 0) {
      logDebug("No recovery subscribers to notify");
      return;
    }

    logInfo(`Notifying ${this.recoveryCallbacks.size} recovery subscribers...`);

    const eventData = {
      healthy: this.isHealthy,
      timestamp: Date.now(),
      pendingElements: this.pendingElements.size,
    };

    this.recoveryCallbacks.forEach((callback) => {
      try {
        callback(eventData);
      } catch (error) {
        logError("Recovery callback error:", error);
      }
    });
  }

  /**
   * Register an element for re-rendering on MathJax recovery
   * Used by MMD Preview when MathJax fails during initial render
   * @param {HTMLElement} element - Element that needs re-rendering
   * @param {Object} [metadata] - Optional metadata about the element
   */
  registerPendingElement(element, metadata = {}) {
    if (!element) {
      logWarn("registerPendingElement requires an element");
      return;
    }

    // Store element reference with metadata
    this.pendingElements.add({
      element,
      metadata,
      registeredAt: Date.now(),
    });

    logDebug(
      `Pending element registered (total: ${this.pendingElements.size})`,
      {
        elementId: element.id || "anonymous",
        metadata,
      },
    );
  }

  /**
   * Get and clear all pending elements
   * Called by MMD Preview during recovery to get elements needing re-render
   * @returns {Array} Array of { element, metadata, registeredAt }
   */
  getPendingElements() {
    const elements = Array.from(this.pendingElements);
    this.pendingElements.clear();
    logDebug(`Retrieved and cleared ${elements.length} pending elements`);
    return elements;
  }

  /**
   * Clear pending elements for a specific container
   * @param {HTMLElement} container - Container element
   */
  clearPendingElementsFor(container) {
    if (!container) return;

    const before = this.pendingElements.size;
    this.pendingElements.forEach((entry) => {
      if (container.contains(entry.element) || entry.element === container) {
        this.pendingElements.delete(entry);
      }
    });
    const removed = before - this.pendingElements.size;

    if (removed > 0) {
      logDebug(`Cleared ${removed} pending elements for container`, {
        containerId: container.id || "anonymous",
      });
    }
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
      op.reject(new Error("Queue manually cleared")),
    );
    this.operationsQueue = [];
    logWarn(`🗑️ Cleared ${cleared} operations from queue`);
    return cleared;
  }

  /**
   * Manually trigger recovery scan and notification
   * Useful for debugging or forcing re-render after dynamic content changes
   * @returns {Promise<{scanned: boolean, notified: boolean}>}
   */
  async triggerRecovery() {
    logInfo("🔄 Manual recovery triggered");

    const result = {
      scanned: false,
      notified: false,
      wasHealthy: this.isHealthy,
    };

    // Check health first
    const isHealthy = await this.checkHealth();

    if (!isHealthy) {
      logWarn("Cannot trigger recovery - MathJax not healthy");
      return result;
    }

    // Notify subscribers
    if (this.recoveryCallbacks.size > 0) {
      this._notifyRecoverySubscribers();
      result.notified = true;
    }

    // Scan for fallbacks
    await this._scanAndRenderFallbacks();
    result.scanned = true;

    logInfo("✅ Manual recovery complete", result);
    return result;
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
